import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js';
import BikeModel from '../models/BikeModel.js';
import Bill from '../models/Bill.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { generateInventoryPDF } from '../services/inventoryPdfService.js';

const MAX_SEARCH_LENGTH = 64;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MONTHLY_SALES_TARGET = 25;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getMonthKey = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const getOwnershipContext = async (req: AuthRequest) => {
  const user = await req.app.locals.models?.User.findById(req.user?.id);
  const isAdmin = user?.role === 'admin';

  return {
    isAdmin,
    inventoryMatch: !isAdmin && req.user?.id
      ? { addedBy: new mongoose.Types.ObjectId(req.user.id) }
      : {},
    billMatch: !isAdmin && req.user?.id
      ? { owner: new mongoose.Types.ObjectId(req.user.id) }
      : {}
  };
};

const getTrendDirection = (value: number) => {
  if (value > 0.05) return 'increasing';
  if (value < -0.05) return 'decreasing';
  return 'stable';
};

const getPaceStatus = (paceGap: number) => {
  if (paceGap >= 1) return 'ahead';
  if (paceGap <= -1) return 'behind';
  return 'on-track';
};

/**
 * Get all bikes in inventory with filtering
 * @route GET /api/inventory
 * @access Private
 */
export const getAllInventory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      modelId,
      search,
      sort = 'dateAdded',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = { isDeleted: { $ne: true } };

    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      // Regular users can only see inventory items they added
      filter.addedBy = req.user.id;
    }

    // Filter by status if provided
    if (status) {
      filter.status = status;
    }

    // Filter by model if provided
    if (modelId) {
      filter.bikeModelId = modelId;
    }

    // Search by motor or chassis number
    if (search) {
      const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
      const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
      filter.$or = [
        { motorNumber: { $regex: safeSearchRegex } },
        { chassisNumber: { $regex: safeSearchRegex } }
      ];
    }

    // Determine sort order
    const sortOptions: any = {};
    sortOptions[sort as string] = order === 'asc' ? 1 : -1;

    // Get total count for pagination
    const total = await BikeInventory.countDocuments(filter);

    // Get inventory items with pagination
    const inventory = await BikeInventory.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
      .populate('addedBy', 'name email');

    res.status(200).json({
      items: inventory,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error(`Error getting inventory: ${(error as Error).message}`);
    next(new AppError(`Failed to fetch inventory: ${(error as Error).message}`, 500));
  }
};

/**
 * Get inventory item by ID
 * @route GET /api/inventory/:id
 * @access Private
 */
export const getInventoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid inventory ID', 400));
    }

    const inventoryItem = await BikeInventory.findById(id)
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
      .populate('addedBy', 'name email')
      .populate('billId', 'billNumber customerName');

    if (!inventoryItem) {
      return next(new AppError('Inventory item not found', 404));
    }

    res.status(200).json(inventoryItem);
  } catch (error) {
    logger.error(`Error getting inventory item: ${(error as Error).message}`);
    next(new AppError(`Failed to fetch inventory item: ${(error as Error).message}`, 500));
  }
};

/**
 * Add bike to inventory
 * @route POST /api/inventory
 * @access Private
 */
export const addToInventory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const inventoryData = req.body;

    // Set the added by field to the current user
    inventoryData.addedBy = req.user?.id;

    // Validate bike model exists
    if (!mongoose.Types.ObjectId.isValid(inventoryData.bikeModelId)) {
      return next(new AppError('Invalid bike model ID', 400));
    }

    const bikeModel = await BikeModel.findById(inventoryData.bikeModelId);
    if (!bikeModel) {
      return next(new AppError('Bike model not found', 404));
    }

    // Create the inventory item
    const inventoryItem = await BikeInventory.create(inventoryData);

    // Populate references for response
    const populatedItem = await BikeInventory.findById(inventoryItem._id)
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
      .populate('addedBy', 'name email');

    res.status(201).json(populatedItem);
  } catch (error) {
    // Check for validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }

    // Check for duplicate key error
    if ((error as any).code === 11000) {
      return next(new AppError('A bike with this motor number or chassis number already exists in inventory', 400));
    }

    logger.error(`Error adding to inventory: ${(error as Error).message}`);
    next(new AppError(`Failed to add to inventory: ${(error as Error).message}`, 500));
  }
};

/**
 * Add multiple bikes to inventory
 * @route POST /api/inventory/batch
 * @access Private
 */
export const batchAddToInventory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('No inventory items provided', 400));
    }

    // Set the added by field for all items
    const itemsWithUser = items.map(item => ({
      ...item,
      addedBy: req.user?.id
    }));

    // Validate all bike models exist
    const modelIds = [...new Set(itemsWithUser.map(item => item.bikeModelId))];

    for (const modelId of modelIds) {
      if (!mongoose.Types.ObjectId.isValid(modelId)) {
        return next(new AppError(`Invalid bike model ID: ${modelId}`, 400));
      }

      const bikeModel = await BikeModel.findById(modelId);
      if (!bikeModel) {
        return next(new AppError(`Bike model not found: ${modelId}`, 404));
      }
    }

    // Create all inventory items
    const result = await BikeInventory.insertMany(itemsWithUser, { ordered: false })
      .catch(error => {
        // Handle duplicate key errors
        if (error.code === 11000) {
          const duplicates = error.writeErrors.map((err: any) => {
            const item = err.err.op;
            return `Motor: ${item.motorNumber}, Chassis: ${item.chassisNumber}`;
          });

          throw new AppError(`Duplicate entries found: ${duplicates.join('; ')}`, 400);
        }
        throw error;
      });

    res.status(201).json({
      message: `Successfully added ${result.length} bikes to inventory`,
      count: result.length,
      items: result
    });
  } catch (error) {
    logger.error(`Error batch adding to inventory: ${(error as Error).message}`);

    // If it's already an AppError, pass it through
    if (error instanceof AppError) {
      return next(error);
    }

    next(new AppError(`Failed to add bikes to inventory: ${(error as Error).message}`, 500));
  }
};

/**
 * Update inventory item
 * @route PUT /api/inventory/:id
 * @access Private
 */
export const updateInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid inventory ID', 400));
    }

    // Don't allow changing the addedBy field
    if (updateData.addedBy) {
      delete updateData.addedBy;
    }

    // If changing status to sold, set the dateSold
    if (updateData.status === BikeStatus.SOLD && !updateData.dateSold) {
      updateData.dateSold = new Date();
    }

    // If changing status from sold, clear the dateSold
    if (updateData.status && updateData.status !== BikeStatus.SOLD) {
      updateData.dateSold = null;
    }

    const updatedItem = await BikeInventory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
      .populate('addedBy', 'name email');

    if (!updatedItem) {
      return next(new AppError('Inventory item not found', 404));
    }

    res.status(200).json(updatedItem);
  } catch (error) {
    // Check for validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }

    // Check for duplicate key error
    if ((error as any).code === 11000) {
      return next(new AppError('A bike with this motor number or chassis number already exists in inventory', 400));
    }

    logger.error(`Error updating inventory: ${(error as Error).message}`);
    next(new AppError(`Failed to update inventory: ${(error as Error).message}`, 500));
  }
};

/**
 * Delete inventory item
 * @route DELETE /api/inventory/:id
 * @access Private
 */
export const deleteInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const allowed: string[] = Array.isArray(req.app?.locals?.allowedOrigins) && req.app.locals.allowedOrigins.length
        ? req.app.locals.allowedOrigins
        : [
            'https://tmr-production.up.railway.app',
            'https://tmr-tradinglanka.pages.dev'
          ];
      const originHeader = req.headers.origin as string | undefined;
      const refererHeader = req.headers.referer as string | undefined;
      const parse = (value?: string): string | null => {
        if (!value) return null;
        try {
          if (/^https?:\/\//i.test(value)) {
            return new URL(value).origin;
          }
          return value;
        } catch {
          return null;
        }
      };
      const candidate = parse(originHeader) || parse(refererHeader);
      if (!candidate || !allowed.includes(candidate)) {
        return next(new AppError('Forbidden', 403));
      }
    }
    const featureEnabled = (process.env.INVENTORY_DELETE_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!featureEnabled) {
      return next(new AppError('Inventory deletion is disabled', 403));
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid inventory ID', 400));
    }

    const inventoryItem = await BikeInventory.findById(id);

    if (!inventoryItem) {
      return next(new AppError('Inventory item not found', 404));
    }

            

    const deleteReasonHeader = (req.headers['x-delete-reason'] as string | undefined) || undefined;
    const reasonBody = (req as any).body?.reason as string | undefined;
    const reason = reasonBody ?? deleteReasonHeader ?? null;

    await BikeInventory.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: (req as any).user?.id ? new mongoose.Types.ObjectId((req as any).user.id) : null,
        deleteReason: reason
      },
      { new: true }
    );

    res.status(200).json({ message: 'Inventory item deleted successfully', softDeleted: true });
  } catch (error) {
    logger.error(`Error deleting inventory: ${(error as Error).message}`);
    next(new AppError(`Failed to delete inventory: ${(error as Error).message}`, 500));
  }
};

/**
 * Get inventory summary by model
 * @route GET /api/inventory/summary
 * @access Private
 */
export const getInventorySummary = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Build filter for ownership
    const matchStage: any = { isDeleted: { $ne: true } };
    
    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      matchStage.addedBy = new mongoose.Types.ObjectId(req.user.id);
    }

    // Build aggregation pipeline
    const pipeline: any[] = [];
    
    // Add match stage if we have filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add the rest of the aggregation stages
    pipeline.push(
      {
        $lookup: {
          from: 'bike_models',
          localField: 'bikeModelId',
          foreignField: '_id',
          as: 'model'
        }
      },
      {
        $unwind: '$model'
      },
      {
        $group: {
          _id: {
            modelId: '$bikeModelId',
            status: '$status'
          },
          count: { $sum: 1 },
          modelName: { $first: '$model.name' },
          price: { $first: '$model.price' },
          isEbicycle: { $first: '$model.is_ebicycle' },
          isTricycle: { $first: '$model.is_tricycle' }
        }
      },
      {
        $group: {
          _id: '$_id.modelId',
          modelName: { $first: '$modelName' },
          price: { $first: '$price' },
          isEbicycle: { $first: '$isEbicycle' },
          isTricycle: { $first: '$isTricycle' },
          statusCounts: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      }
    );

    // Add final stages to pipeline
    pipeline.push(
      {
        $project: {
          _id: 0,
          modelId: '$_id',
          modelName: 1,
          price: 1,
          isEbicycle: 1,
          isTricycle: 1,
          statusCounts: 1,
          totalCount: 1
        }
      },
      {
        $sort: { modelName: 1 }
      }
    );

    // Get summary by bike model
    const summary = await BikeInventory.aggregate(pipeline);

    // Get total counts by status
    const statusTotals = await BikeInventory.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1
        }
      }
    ]);

    // Calculate total inventory value
    const inventoryValue = await BikeInventory.aggregate([
      { $match: { status: BikeStatus.AVAILABLE, isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'bike_models',
          localField: 'bikeModelId',
          foreignField: '_id',
          as: 'model'
        }
      },
      {
        $unwind: '$model'
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$model.price' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      summary,
      statusTotals,
      inventoryValue: inventoryValue.length > 0 ? inventoryValue[0] : { totalValue: 0, count: 0 }
    });
  } catch (error) {
    logger.error(`Error getting inventory summary: ${(error as Error).message}`);
    next(new AppError(`Failed to get inventory summary: ${(error as Error).message}`, 500));
  }
};

/**
 * Get enhanced inventory analytics for professional reporting
 * @route GET /api/inventory/analytics
 * @access Private
 */
export const getInventoryAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get current date for calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    // Build filter for ownership
    const matchStage: any = { isDeleted: { $ne: true } };
    
    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      matchStage.addedBy = new mongoose.Types.ObjectId(req.user.id);
    }

    // Build aggregation pipeline for model performance
    const modelPipeline: any[] = [];
    
    // Add match stage if we have filters
    if (Object.keys(matchStage).length > 0) {
      modelPipeline.push({ $match: matchStage });
    }

    // Add the rest of the aggregation stages
    modelPipeline.push(
      {
        $lookup: {
          from: 'bike_models',
          localField: 'bikeModelId',
          foreignField: '_id',
          as: 'model'
        }
      },
      {
        $unwind: '$model'
      }
    );

    // Enhanced model performance with revenue and aging analysis
    const modelPerformance = await BikeInventory.aggregate(modelPipeline.concat([
      {
        $group: {
          _id: '$bikeModelId',
          modelName: { $first: '$model.name' },
          price: { $first: '$model.price' },
          isEbicycle: { $first: '$model.is_ebicycle' },
          isTricycle: { $first: '$model.is_tricycle' },
          totalUnits: { $sum: 1 },
          availableUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          soldUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
          },
          reservedUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] }
          },
          damagedUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'damaged'] }, 1, 0] }
          },
          recentSales: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'sold'] },
                    { $gte: ['$dateSold', thirtyDaysAgo] }
                  ]
                },
                1,
                0
              ]
            }
          },
          oldStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'available'] },
                    { $lte: ['$dateAdded', ninetyDaysAgo] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          totalValue: { $multiply: ['$totalUnits', '$price'] },
          availableValue: { $multiply: ['$availableUnits', '$price'] },
          soldValue: { $multiply: ['$soldUnits', '$price'] },
          sellThroughRate: {
            $cond: [
              { $gt: ['$totalUnits', 0] },
              { $multiply: [{ $divide: ['$soldUnits', '$totalUnits'] }, 100] },
              0
            ]
          },
          monthlyVelocity: '$recentSales',
          stockHealth: {
            $cond: [
              { $gt: ['$oldStock', 0] }, 'Slow Moving',
              { $cond: [
                { $gt: ['$recentSales', 2] }, 'Fast Moving',
                'Normal'
              ]}
            ]
          }
        }
      },
      {
        $sort: { soldValue: -1 }
      }
    ]));

    // Calculate key performance indicators
    const kpis = await BikeInventory.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'bike_models',
          localField: 'bikeModelId',
          foreignField: '_id',
          as: 'model'
        }
      },
      {
        $unwind: '$model'
      },
      {
        $group: {
          _id: null,
          totalInventoryValue: { $sum: '$model.price' },
          availableInventoryValue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'available'] },
                '$model.price',
                0
              ]
            }
          },
          soldInventoryValue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'sold'] },
                '$model.price',
                0
              ]
            }
          },
          totalUnits: { $sum: 1 },
          availableUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          soldUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
          },
          reservedUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] }
          },
          damagedUnits: {
            $sum: { $cond: [{ $eq: ['$status', 'damaged'] }, 1, 0] }
          },
          recentSales: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'sold'] },
                    { $gte: ['$dateSold', thirtyDaysAgo] }
                  ]
                },
                1,
                0
              ]
            }
          },
          oldStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'available'] },
                    { $lte: ['$dateAdded', ninetyDaysAgo] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          inventoryTurnoverRate: {
            $cond: [
              { $gt: ['$availableInventoryValue', 0] },
              { $divide: ['$soldInventoryValue', '$availableInventoryValue'] },
              0
            ]
          },
          stockoutRisk: {
            $cond: [
              { $lt: ['$availableUnits', 5] },
              'High',
              { $cond: [
                { $lt: ['$availableUnits', 10] },
                'Medium',
                'Low'
              ]}
            ]
          }
        }
      }
    ]);

    // Enhanced Category breakdown with monthly performance
    const categoryBreakdown = await BikeInventory.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: 'bike_models',
          localField: 'bikeModelId',
          foreignField: '_id',
          as: 'model'
        }
      },
      {
        $unwind: '$model'
      },
      {
        $group: {
          _id: {
            isEbicycle: '$model.is_ebicycle',
            isTricycle: '$model.is_tricycle'
          },
          count: { $sum: 1 },
          value: { $sum: '$model.price' },
          available: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          sold: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
          },
          // Monthly arrivals (bikes added in last 30 days)
          monthlyArrivals: {
            $sum: {
              $cond: [
                { $gte: ['$dateAdded', thirtyDaysAgo] },
                1,
                0
              ]
            }
          },
          // Monthly sales (bikes sold in last 30 days)
          monthlySales: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'sold'] },
                    { $gte: ['$dateSold', thirtyDaysAgo] }
                  ]
                },
                1,
                0
              ]
            }
          },
          // Average days to sell (for sold items)
          avgDaysToSell: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'sold'] },
                {
                  $divide: [
                    { $subtract: ['$dateSold', '$dateAdded'] },
                    86400000 // Convert milliseconds to days
                  ]
                },
                null
              ]
            }
          }
        }
      },
      {
        $addFields: {
          category: {
            $cond: [
              '$_id.isTricycle', 'E-Tricycles',
              { $cond: ['$_id.isEbicycle', 'E-Bicycles', 'E-Motorcycles'] }
            ]
          },
          // Calculate monthly performance metrics
          monthlyTurnoverRate: {
            $cond: [
              { $gt: ['$monthlyArrivals', 0] },
              { $multiply: [{ $divide: ['$monthlySales', '$monthlyArrivals'] }, 100] },
              0
            ]
          },
          sellThroughRate: {
            $cond: [
              { $gt: ['$count', 0] },
              { $multiply: [{ $divide: ['$sold', '$count'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          category: 1,
          count: 1,
          value: 1,
          available: 1,
          sold: 1,
          monthlyArrivals: 1,
          monthlySales: 1,
          monthlyTurnoverRate: 1,
          sellThroughRate: 1,
          avgDaysToSell: { $round: ['$avgDaysToSell', 0] }
        }
      }
    ]);

    // Generate insights and recommendations
    const insights = generateInventoryInsights(modelPerformance, kpis[0] || {});

    res.status(200).json({
      modelPerformance,
      kpis: kpis[0] || {},
      categoryBreakdown,
      insights,
      reportGenerated: now
    });
  } catch (error) {
    logger.error(`Error getting inventory analytics: ${(error as Error).message}`);
    next(new AppError(`Failed to get inventory analytics: ${(error as Error).message}`, 500));
  }
};

/**
 * Get focused analytics for the /inventory/report dashboard
 * @route GET /api/inventory/report/analytics
 * @access Private
 */
export const getInventoryReportAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const currentMonthStart = getMonthStart(now);
    const nextMonthStart = addMonths(currentMonthStart, 1);
    const previousMonthStart = addMonths(currentMonthStart, -1);
    const reportWindowStart = addMonths(currentMonthStart, -5);
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    const currentDayOfMonth = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const previousMonthDays = new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth() + 1, 0).getDate();
    const comparablePreviousDay = Math.min(currentDayOfMonth, previousMonthDays);
    const previousComparableEnd = new Date(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), comparablePreviousDay + 1);

    const { inventoryMatch, billMatch } = await getOwnershipContext(req);

    const [salesByModelRaw, agedStockRaw, revenueSeriesRaw, currentMonthSalesAgg, previousMonthSalesAgg] = await Promise.all([
      BikeInventory.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: BikeStatus.SOLD,
            dateSold: { $gte: reportWindowStart, $lt: nextMonthStart },
            ...inventoryMatch
          }
        },
        {
          $lookup: {
            from: 'bike_models',
            localField: 'bikeModelId',
            foreignField: '_id',
            as: 'model'
          }
        },
        { $unwind: '$model' },
        {
          $group: {
            _id: {
              modelId: '$bikeModelId',
              modelName: '$model.name',
              year: { $year: '$dateSold' },
              month: { $month: '$dateSold' }
            },
            soldUnits: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            modelId: '$_id.modelId',
            modelName: '$_id.modelName',
            year: '$_id.year',
            month: '$_id.month',
            soldUnits: 1
          }
        },
        { $sort: { year: 1, month: 1, modelName: 1 } }
      ]),
      BikeInventory.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: BikeStatus.AVAILABLE,
            dateAdded: { $lte: ninetyDaysAgo },
            ...inventoryMatch
          }
        },
        {
          $lookup: {
            from: 'bike_models',
            localField: 'bikeModelId',
            foreignField: '_id',
            as: 'model'
          }
        },
        { $unwind: '$model' },
        {
          $addFields: {
            ageDays: {
              $round: [
                {
                  $divide: [
                    { $subtract: [now, '$dateAdded'] },
                    86400000
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: '$bikeModelId',
            modelName: { $first: '$model.name' },
            price: { $first: '$model.price' },
            agedUnits: { $sum: 1 },
            oldestDateAdded: { $min: '$dateAdded' },
            averageAgeMs: {
              $avg: {
                $subtract: [now, '$dateAdded']
              }
            },
            chassisNumbers: { $push: '$chassisNumber' }
          }
        },
        {
          $addFields: {
            oldestAgeDays: {
              $round: [
                {
                  $divide: [
                    { $subtract: [now, '$oldestDateAdded'] },
                    86400000
                  ]
                },
                0
              ]
            },
            averageAgeDays: {
              $round: [
                { $divide: ['$averageAgeMs', 86400000] },
                0
              ]
            },
            stockValueAtRisk: { $multiply: ['$agedUnits', '$price'] }
          }
        },
        {
          $project: {
            _id: 0,
            modelId: '$_id',
            modelName: 1,
            price: 1,
            agedUnits: 1,
            oldestDateAdded: 1,
            oldestAgeDays: 1,
            averageAgeDays: 1,
            stockValueAtRisk: 1,
            chassisNumbers: 1
          }
        },
        { $sort: { oldestAgeDays: -1, stockValueAtRisk: -1 } }
      ]),
      Bill.aggregate([
        {
          $match: {
            billDate: { $gte: reportWindowStart, $lt: nextMonthStart },
            ...billMatch
          }
        },
        {
          $addFields: {
            revenueAmount: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $eq: ['$isAdvancePayment', true] },
                        { $eq: [{ $ifNull: ['$finalBillId', null] }, null] },
                        { $ne: ['$status', 'cancelled'] }
                      ]
                    },
                    then: { $ifNull: ['$advanceAmount', 0] }
                  },
                  {
                    case: {
                      $and: [
                        { $ne: ['$isAdvancePayment', true] },
                        { $eq: ['$status', 'completed'] }
                      ]
                    },
                    then: { $ifNull: ['$totalAmount', 0] }
                  }
                ],
                default: 0
              }
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$billDate' },
              month: { $month: '$billDate' }
            },
            revenue: { $sum: '$revenueAmount' }
          }
        },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            revenue: 1
          }
        },
        { $sort: { year: 1, month: 1 } }
      ]),
      BikeInventory.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: BikeStatus.SOLD,
            dateSold: { $gte: currentMonthStart, $lt: nextMonthStart },
            ...inventoryMatch
          }
        },
        { $count: 'soldUnits' }
      ]),
      BikeInventory.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: BikeStatus.SOLD,
            dateSold: { $gte: previousMonthStart, $lt: previousComparableEnd },
            ...inventoryMatch
          }
        },
        { $count: 'soldUnits' }
      ])
    ]);

    const months = Array.from({ length: 6 }, (_, index) => addMonths(reportWindowStart, index)).map(monthDate => ({
      key: getMonthKey(monthDate),
      label: MONTH_LABEL_FORMATTER.format(monthDate)
    }));

    const salesByModelMap = new Map<string, any>();
    const monthTotalsMap = new Map<string, number>();

    salesByModelRaw.forEach((entry: any) => {
      const monthDate = new Date(entry.year, entry.month - 1, 1);
      const monthKey = getMonthKey(monthDate);

      if (!salesByModelMap.has(entry.modelName)) {
        salesByModelMap.set(entry.modelName, {
          modelId: String(entry.modelId),
          modelName: entry.modelName,
          totalSold: 0,
          months: Object.fromEntries(months.map(month => [month.key, 0]))
        });
      }

      const modelRow = salesByModelMap.get(entry.modelName);
      modelRow.months[monthKey] = entry.soldUnits;
      modelRow.totalSold += entry.soldUnits;
      monthTotalsMap.set(monthKey, (monthTotalsMap.get(monthKey) || 0) + entry.soldUnits);
    });

    const salesRows = Array.from(salesByModelMap.values())
      .sort((left, right) => right.totalSold - left.totalSold || left.modelName.localeCompare(right.modelName));

    const currentMonthKey = getMonthKey(currentMonthStart);
    const currentMonthTopModel = salesRows
      .map((row: any) => ({ modelName: row.modelName, soldUnits: row.months[currentMonthKey] || 0 }))
      .sort((left, right) => right.soldUnits - left.soldUnits || left.modelName.localeCompare(right.modelName))[0] || null;

    const revenueByMonth = new Map<string, number>();
    revenueSeriesRaw.forEach((entry: any) => {
      const monthDate = new Date(entry.year, entry.month - 1, 1);
      revenueByMonth.set(getMonthKey(monthDate), entry.revenue || 0);
    });

    const revenueSeries = months.map(month => ({
      monthKey: month.key,
      label: month.label,
      revenue: revenueByMonth.get(month.key) || 0
    }));

    const soldUnitsMTD = currentMonthSalesAgg[0]?.soldUnits || 0;
    const previousMonthSamePeriodUnits = previousMonthSalesAgg[0]?.soldUnits || 0;
    const expectedUnitsByToday = Number(((MONTHLY_SALES_TARGET * currentDayOfMonth) / daysInCurrentMonth).toFixed(1));
    const paceGap = Number((soldUnitsMTD - expectedUnitsByToday).toFixed(1));
    const projectedMonthEndUnits = currentDayOfMonth > 0
      ? Number(((soldUnitsMTD / currentDayOfMonth) * daysInCurrentMonth).toFixed(1))
      : 0;

    const currentMonthRevenue = revenueByMonth.get(currentMonthKey) || 0;
    const previousMonthSamePeriodRevenue = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: previousMonthStart, $lt: previousComparableEnd },
          ...billMatch
        }
      },
      {
        $addFields: {
          revenueAmount: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $eq: ['$isAdvancePayment', true] },
                      { $eq: [{ $ifNull: ['$finalBillId', null] }, null] },
                      { $ne: ['$status', 'cancelled'] }
                    ]
                  },
                  then: { $ifNull: ['$advanceAmount', 0] }
                },
                {
                  case: {
                    $and: [
                      { $ne: ['$isAdvancePayment', true] },
                      { $eq: ['$status', 'completed'] }
                    ]
                  },
                  then: { $ifNull: ['$totalAmount', 0] }
                }
              ],
              default: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$revenueAmount' }
        }
      }
    ]);

    const previousRevenueValue = previousMonthSamePeriodRevenue[0]?.revenue || 0;
    const unitTrendPercent = previousMonthSamePeriodUnits > 0
      ? (soldUnitsMTD - previousMonthSamePeriodUnits) / previousMonthSamePeriodUnits
      : (soldUnitsMTD > 0 ? 1 : 0);
    const revenueTrendPercent = previousRevenueValue > 0
      ? (currentMonthRevenue - previousRevenueValue) / previousRevenueValue
      : (currentMonthRevenue > 0 ? 1 : 0);

    const stockPenaltyAlerts = agedStockRaw.map((entry: any) => ({
      ...entry,
      severity: entry.oldestAgeDays >= 150 ? 'critical' : entry.oldestAgeDays >= 120 ? 'high' : 'warning'
    }));

    res.status(200).json({
      generatedAt: now,
      monthlyPerformance: {
        monthKey: currentMonthKey,
        monthLabel: MONTH_LABEL_FORMATTER.format(currentMonthStart),
        targetUnits: MONTHLY_SALES_TARGET,
        soldUnitsMTD,
        expectedUnitsByToday,
        projectedMonthEndUnits,
        paceGap,
        paceStatus: getPaceStatus(paceGap),
        remainingToTarget: Math.max(MONTHLY_SALES_TARGET - soldUnitsMTD, 0),
        lastMonthSamePeriodUnits: previousMonthSamePeriodUnits,
        unitTrendDirection: getTrendDirection(unitTrendPercent),
        unitTrendPercent,
        revenueMTD: currentMonthRevenue,
        lastMonthSamePeriodRevenue: previousRevenueValue,
        revenueTrendDirection: getTrendDirection(revenueTrendPercent),
        revenueTrendPercent,
        daysElapsed: currentDayOfMonth,
        daysInMonth: daysInCurrentMonth
      },
      revenueSeries,
      salesByModelPerMonth: {
        months,
        rows: salesRows,
        totals: months.map(month => ({
          monthKey: month.key,
          soldUnits: monthTotalsMap.get(month.key) || 0
        })),
        currentMonthTopModel
      },
      stockPenaltyAlerts,
      stockPenaltySummary: {
        totalModels: stockPenaltyAlerts.length,
        totalUnits: stockPenaltyAlerts.reduce((sum: number, entry: any) => sum + entry.agedUnits, 0),
        totalValueAtRisk: stockPenaltyAlerts.reduce((sum: number, entry: any) => sum + entry.stockValueAtRisk, 0)
      }
    });
  } catch (error) {
    logger.error(`Error getting inventory report analytics: ${(error as Error).message}`);
    next(new AppError(`Failed to get inventory report analytics: ${(error as Error).message}`, 500));
  }
};

/**
 * Generate actionable business insights from inventory data
 */
const generateInventoryInsights = (modelPerformance: any[], kpis: any) => {
  const insights = [];

  // Critical stock alerts (highest priority)
  const lowStock = modelPerformance.filter(model => model.availableUnits <= 2 && model.availableUnits > 0);
  const outOfStock = modelPerformance.filter(model => model.availableUnits === 0);

  if (outOfStock.length > 0) {
    insights.push({
      type: 'error',
      title: 'URGENT: Restock Required',
      message: `${outOfStock.map(m => m.modelName).join(', ')} - Zero inventory. Order immediately.`
    });
  }

  if (lowStock.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Low Stock Alert',
      message: `${lowStock.map(m => m.modelName).join(', ')} - Only ${lowStock[0]?.availableUnits || 0} units left. Reorder soon.`
    });
  }

  // Revenue opportunities
  const topPerformer = modelPerformance.find(model => model.sellThroughRate > 70);
  if (topPerformer) {
    insights.push({
      type: 'success',
      title: 'Hot Seller Opportunity',
      message: `${topPerformer.modelName} has ${topPerformer.sellThroughRate.toFixed(0)}% sell-through. Increase stock for more revenue.`
    });
  }

  // Slow movers that need action
  const slowMoving = modelPerformance.filter(model =>
    model.stockHealth === 'Slow Moving' && model.availableUnits > 5
  );
  if (slowMoving.length > 0) {
    const slowModel = slowMoving[0];
    insights.push({
      type: 'warning',
      title: 'Clear Dead Stock',
      message: `${slowModel.modelName} - ${slowModel.availableUnits} units aging 90+ days. Run promotion to move inventory.`
    });
  }

  // Cash flow insights
  const totalSlowValue = slowMoving.reduce((sum, model) => sum + (model.availableUnits * model.price), 0);
  if (totalSlowValue > 1000000) {
    insights.push({
      type: 'error',
      title: 'Cash Flow Risk',
      message: `Rs. ${(totalSlowValue/1000000).toFixed(1)}M tied up in slow inventory. Consider discounts to free cash.`
    });
  }

  // Performance benchmarks
  const avgSellThrough = modelPerformance.reduce((sum, model) => sum + model.sellThroughRate, 0) / modelPerformance.length;
  if (avgSellThrough < 30) {
    insights.push({
      type: 'warning',
      title: 'Sales Velocity Low',
      message: `Average sell-through only ${avgSellThrough.toFixed(0)}%. Review pricing or marketing strategy.`
    });
  }

  // Inventory balance insights
  if (kpis.availableUnits < 10) {
    insights.push({
      type: 'error',
      title: 'Inventory Crisis',
      message: `Only ${kpis.availableUnits} total units available. Risk of stockouts across all models.`
    });
  }

  return insights.slice(0, 4); // Limit to top 4 most actionable insights
};

/**
 * Get available bikes for a specific model
 * @route GET /api/inventory/available/:modelId
 * @access Private
 */
export const getAvailableBikesByModel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { modelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(modelId)) {
      return next(new AppError('Invalid bike model ID', 400));
    }

    // Build filter query
    const filter: any = {
      bikeModelId: modelId,
      status: BikeStatus.AVAILABLE,
      isDeleted: { $ne: true }
    };

    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      filter.addedBy = req.user.id;
    }

    const availableBikes = await BikeInventory.find(filter)
      .sort({ dateAdded: 1 })
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle');

    res.status(200).json(availableBikes);
  } catch (error) {
    logger.error(`Error getting available bikes: ${(error as Error).message}`);
    next(new AppError(`Failed to get available bikes: ${(error as Error).message}`, 500));
  }
};

/**
 * Generate PDF for inventory report
 * @route GET /api/inventory/report/pdf
 * @access Private
 */
export const generateInventoryReportPDF = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const sortMode = req.query.sortMode === 'model' ? 'model' : 'date';

    // Build filter query
    const filter: any = { isDeleted: { $ne: true } };

    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      filter.addedBy = req.user.id;
    }

    // Get all inventory items with bike model details
    const inventoryItems = await BikeInventory.find(filter)
      .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
      .sort({ dateAdded: 1, _id: 1 });

    const sortedInventoryItems = sortMode === 'model'
      ? [...inventoryItems].sort((a: any, b: any) => {
          const modelA = (a?.bikeModelId as any)?.name || '';
          const modelB = (b?.bikeModelId as any)?.name || '';
          const modelCompare = modelA.localeCompare(modelB);

          if (modelCompare !== 0) return modelCompare;

          return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
        })
      : inventoryItems;

    // Count available bikes
    const totalAvailable = inventoryItems.filter(item => item.status === 'available').length;

    // Generate basic insights for action items
    const insights = [
      {
        type: 'info',
        message: `Total ${totalAvailable} bikes available in stock`,
        priority: 'low'
      },
      {
        type: 'warning',
        message: 'Regular stock verification recommended',
        priority: 'medium'
      },
      {
        type: 'success',
        message: 'Inventory tracking system operational',
        priority: 'low'
      }
    ];

    // Prepare data for PDF generation
    const inventoryData = {
      inventoryItems: sortedInventoryItems as any[],
      totalAvailable,
      insights,
      reportGenerated: now
    };

    // Generate PDF
    const pdfBuffer = await generateInventoryPDF(inventoryData, req.user?.id);

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Gunawardhana_Motors_Inventory_Report_${now.toISOString().split('T')[0]}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    logger.error(`Error generating inventory PDF: ${(error as Error).message}`);
    next(new AppError(`Failed to generate inventory PDF: ${(error as Error).message}`, 500));
  }
};
