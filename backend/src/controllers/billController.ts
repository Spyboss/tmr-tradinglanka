import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js';
import { generatePDF } from '../services/pdfService.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Create a new bill with inventory integration
 * @route POST /api/bills
 * @access Private
 */
export const createBill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    logger.info(`Received bill data`);
    
    const billData = req.body;
    
    // Set the owner as the current authenticated user
    billData.owner = req.user?.id;
    
    // Check if inventory item is provided
    if (billData.inventoryItemId) {
      // Validate and update inventory item
      if (!mongoose.Types.ObjectId.isValid(billData.inventoryItemId)) {
        return next(new AppError('Invalid inventory item ID', 400));
      }
      
      const inventoryItem = await BikeInventory.findById(billData.inventoryItemId).session(session);
      
      if (!inventoryItem) {
        return next(new AppError('Inventory item not found', 404));
      }
      
      if (inventoryItem.status !== BikeStatus.AVAILABLE) {
        return next(new AppError(`This bike is not available (current status: ${inventoryItem.status})`, 400));
      }
      
      // Get bike details from inventory
      const bikeModel = await mongoose.model('BikeModel').findById(inventoryItem.bikeModelId).session(session);
      
      if (!bikeModel) {
        return next(new AppError('Bike model not found', 404));
      }
      
      // Set bike details from inventory
      billData.bikeModel = bikeModel.name;
      billData.motorNumber = inventoryItem.motorNumber;
      billData.chassisNumber = inventoryItem.chassisNumber;
      billData.bikePrice = bikeModel.price;
      billData.isEbicycle = bikeModel.is_ebicycle;
      billData.isTricycle = bikeModel.is_tricycle;
    }

    // If no explicit inventory item provided, try auto-link by motor+chassis
    if (!billData.inventoryItemId && billData.motorNumber && billData.chassisNumber) {
      const motor = String(billData.motorNumber).trim();
      const chassis = String(billData.chassisNumber).trim();

      if (motor && chassis) {
        const motorRegex = new RegExp(`^${escapeRegExp(motor)}$`, 'i');
        const chassisRegex = new RegExp(`^${escapeRegExp(chassis)}$`, 'i');

        const matchedItem = await BikeInventory.findOne({
          motorNumber: motorRegex,
          chassisNumber: chassisRegex,
          status: BikeStatus.AVAILABLE
        }).session(session);

        if (matchedItem) {
          const bikeModel = await mongoose.model('BikeModel').findById(matchedItem.bikeModelId).session(session);
          if (bikeModel) {
            billData.inventoryItemId = matchedItem._id;
            billData.bikeModel = bikeModel.name;
            billData.motorNumber = matchedItem.motorNumber;
            billData.chassisNumber = matchedItem.chassisNumber;
            billData.bikePrice = bikeModel.price;
            billData.isEbicycle = bikeModel.is_ebicycle;
            billData.isTricycle = bikeModel.is_tricycle;
          }
        }
      }
    }
    
    // Determine vehicle type and set appropriate flags
    if (billData.isTricycle) {
      // Tricycle rules:
      billData.vehicleType = 'E-TRICYCLE';
      billData.billType = 'cash'; // Only cash sales for tricycles
      billData.rmvCharge = 0; // No RMV charges for tricycles
      
      // Check if this is the first tricycle sale
      const tricycleBillCount = await Bill.countDocuments({ isTricycle: true }).session(session);
      if (tricycleBillCount === 0) {
        billData.isFirstTricycleSale = true;
      }
    } else if (billData.isEbicycle) {
      // E-Bicycle rules:
      billData.vehicleType = 'E-MOTORBICYCLE';
      billData.billType = 'cash'; // Only cash sales for e-bicycles
      billData.rmvCharge = 0; // No RMV charges for e-bicycles
    } else {
      // Regular E-Motorcycle rules:
      billData.vehicleType = 'E-MOTORCYCLE';
      
      // Set correct RMV charge based on bill type
      if (billData.billType === 'cash') {
        billData.rmvCharge = 13000;
      } else if (billData.billType === 'leasing') {
        billData.rmvCharge = 13500; // CPZ charge
      }
    }
    
    // Calculate total amount based on vehicle type and bill type
    if (billData.billType === 'leasing') {
      // For leasing, total amount is down payment
      billData.totalAmount = parseFloat(billData.downPayment || 0);
    } else {
      // For cash, total depends on vehicle type
      if (billData.isEbicycle || billData.isTricycle) {
        // E-Bicycles and Tricycles: just the bike price
        billData.totalAmount = parseFloat(billData.bikePrice || 0);
      } else {
        // Regular E-Motorcycles: bike price + RMV
        billData.totalAmount = parseFloat(billData.bikePrice || 0) + parseFloat(billData.rmvCharge || 0);
      }
    }
    
    // Handle advance payment
    if (billData.isAdvancePayment) {
      const advanceAmount = parseFloat(billData.advanceAmount || 0);
      billData.balanceAmount = billData.totalAmount - advanceAmount;
      billData.status = 'pending'; // Advance payments are pending until fully paid
    } else {
      billData.status = 'completed'; // Regular bills are marked as completed by default
    }
    
    // Create and save the bill
    const newBill = new Bill(billData);
    const savedBill = await newBill.save({ session });
    
    // Update inventory item if provided
    if (billData.inventoryItemId && savedBill.status === 'completed') {
      await BikeInventory.findByIdAndUpdate(
        billData.inventoryItemId,
        {
          status: BikeStatus.SOLD,
          dateSold: new Date(),
          billId: savedBill._id
        },
        { session }
      );
    }
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    logger.info('Bill saved successfully');
    res.status(201).json(savedBill);
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Error creating bill: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }
    
    next(new AppError(`Failed to create bill: ${(error as Error).message}`, 500));
  }
};

/**
 * Update bill status and handle inventory
 * @route PATCH /api/bills/:id/status
 * @access Private
 */
export const updateBillStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return next(new AppError('Status is required', 400));
    }
    
    // Find the bill
    const bill = await Bill.findById(id).session(session);
    
    if (!bill) {
      return next(new AppError('Bill not found', 404));
    }
    
    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;
    
    if (!isAdmin && !isOwner) {
      return next(new AppError('You do not have permission to update this bill', 403));
    }
    
    // Update bill status
    bill.status = status;
    await bill.save({ session });
    
    // Handle inventory if bill has an inventory item
    if (bill.inventoryItemId) {
      if (status === 'completed') {
        // Mark inventory item as sold
        await BikeInventory.findByIdAndUpdate(
          bill.inventoryItemId,
          {
            status: BikeStatus.SOLD,
            dateSold: new Date(),
            billId: bill._id
          },
          { session }
        );
      } else if (status === 'cancelled') {
        // Return inventory item to available
        await BikeInventory.findByIdAndUpdate(
          bill.inventoryItemId,
          {
            status: BikeStatus.AVAILABLE,
            dateSold: null,
            billId: null
          },
          { session }
        );
      }
    }
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json(bill);
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Error updating bill status: ${error instanceof Error ? error.message : String(error)}`);
    next(new AppError(`Failed to update bill status: ${(error as Error).message}`, 500));
  }
};
