import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import WarrantyClaim from '../models/WarrantyClaim.js';
import Bill from '../models/Bill.js';
import BikeInventory from '../models/BikeInventory.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateWarrantyPDF } from '../services/warrantyPdfService.js';

export const getAllWarrantyClaims = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, search } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    if (!isAdmin && req.user?.id) {
      filter.owner = req.user.id;
    }

    if (status) filter.status = status;

    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { warrantyNumber: regex },
        { customerName: regex },
        { chassisNumber: regex },
        { motorNumber: regex }
      ];
    }

    const claims = await WarrantyClaim.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await WarrantyClaim.countDocuments(filter);

    res.status(200).json({
      claims,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    next(new AppError(`Failed to fetch warranty claims: ${(error as Error).message}`, 500));
  }
};

export const getWarrantyClaimById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claim = await WarrantyClaim.findById(req.params.id);
    if (!claim) {
      return next(new AppError('Warranty claim not found', 404));
    }

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = claim.owner && claim.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return next(new AppError('You do not have permission to view this warranty claim', 403));
    }

    res.status(200).json(claim);
  } catch (error) {
    next(new AppError(`Failed to fetch warranty claim: ${(error as Error).message}`, 500));
  }
};

export const getPrefillData = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { billId, chassisNumber } = req.query as any;

    let bill: any = null;

    if (billId && mongoose.Types.ObjectId.isValid(billId)) {
      bill = await Bill.findById(billId);
    } else if (chassisNumber) {
      bill = await Bill.findOne({ chassisNumber: String(chassisNumber).trim() });
    }

    if (!bill) {
      res.status(200).json({ prefill: null });
      return;
    }

    let color = bill.proforma?.color || '';
    if (!color && bill.inventoryItemId) {
      const inventory = await BikeInventory.findById(bill.inventoryItemId);
      if (inventory?.notes) {
        color = inventory.notes;
      }
    }

    res.status(200).json({
      prefill: {
        customerName: bill.customerName || '',
        customerPhone: bill.customerPhone || '',
        customerAddress: bill.customerAddress || '',
        chassisNumber: bill.chassisNumber || '',
        motorNumber: bill.motorNumber || '',
        bikeModel: bill.bikeModel || '',
        color,
        dateOfSale: bill.billDate || null,
        billId: bill._id
      }
    });
  } catch (error) {
    next(new AppError(`Failed to get prefill data: ${(error as Error).message}`, 500));
  }
};

export const searchBills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q = '' } = req.query as any;

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const ownerFilter: any = {};
    if (!isAdmin && req.user?.id) ownerFilter.owner = req.user.id;

    const regex = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const bills = await Bill.find({
      ...ownerFilter,
      $or: [
        { billNumber: regex },
        { customerName: regex },
        { chassisNumber: regex },
        { motorNumber: regex }
      ]
    })
      .select('billNumber customerName customerPhone chassisNumber motorNumber bikeModel billDate')
      .limit(10)
      .sort({ createdAt: -1 });

    res.status(200).json({ bills });
  } catch (error) {
    next(new AppError(`Failed to search bills: ${(error as Error).message}`, 500));
  }
};

export const checkFormNumber = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { number, excludeId } = req.query as any;
    if (!number || !String(number).trim()) {
      res.status(200).json({ available: true });
      return;
    }

    const filter: any = { formNumber: String(number).trim() };
    if (excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))) {
      filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    }

    const existing = await WarrantyClaim.findOne(filter).select('_id');
    res.status(200).json({ available: !existing });
  } catch (error) {
    next(new AppError(`Failed to check form number: ${(error as Error).message}`, 500));
  }
};

export const suggestNextFormNumber = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await WarrantyClaim.findOne({ formNumber: { $ne: '' } })
      .sort({ formNumber: -1 })
      .select('formNumber');

    const maxNum = result ? parseInt(result.formNumber, 10) : 0;
    const nextNum = isNaN(maxNum) ? 1 : maxNum + 1;
    res.status(200).json({ formNumber: String(nextNum).padStart(4, '0') });
  } catch (error) {
    next(new AppError(`Failed to suggest form number: ${(error as Error).message}`, 500));
  }
};

export const createWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const formNumber = req.body?.formNumber as string | undefined;
  try {
    const claimData = req.body;
    claimData.owner = req.user?.id;

    const newClaim = new WarrantyClaim(claimData);
    const savedClaim = await newClaim.save();

    res.status(201).json(savedClaim);
  } catch (error: any) {
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation error: ${messages.join(', ')}`, 400));
    }
    if (error.code === 11000 && error.keyPattern?.formNumber) {
      return next(new AppError(`Form number "${formNumber}" is already in use. Please check the physical warranty book and use the next available number.`, 409));
    }
    next(new AppError(`Failed to create warranty claim: ${(error as Error).message}`, 500));
  }
};

export const updateWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const newFormNumber = req.body?.formNumber as string | undefined;
  try {
    const claim = await WarrantyClaim.findById(req.params.id);
    if (!claim) {
      return next(new AppError('Warranty claim not found', 404));
    }

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = claim.owner && claim.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return next(new AppError('You do not have permission to update this warranty claim', 403));
    }

    if (req.body.owner && !isAdmin) {
      delete req.body.owner;
    }

    Object.entries(req.body).forEach(([key, value]) => {
      (claim as any).set(key, value);
    });
    const updatedClaim = await claim.save();

    res.status(200).json(updatedClaim);
  } catch (error: any) {
    if (error.code === 11000 && error.keyPattern?.formNumber) {
      return next(new AppError(`Form number "${newFormNumber}" is already in use by another claim. Please use a different number.`, 409));
    }
    next(new AppError(`Failed to update warranty claim: ${(error as Error).message}`, 500));
  }
};

export const deleteWarrantyClaim = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claim = await WarrantyClaim.findById(req.params.id);
    if (!claim) {
      return next(new AppError('Warranty claim not found', 404));
    }

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = claim.owner && claim.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return next(new AppError('You do not have permission to delete this warranty claim', 403));
    }

    await WarrantyClaim.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Warranty claim deleted successfully' });
  } catch (error) {
    next(new AppError(`Failed to delete warranty claim: ${(error as Error).message}`, 500));
  }
};

export const generateWarrantyClaimPDF = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claim = await WarrantyClaim.findById(req.params.id);
    if (!claim) {
      return next(new AppError('Warranty claim not found', 404));
    }

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = claim.owner && claim.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return next(new AppError('You do not have permission to view this warranty claim', 403));
    }

    const pdfBuffer = await generateWarrantyPDF(claim);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=TMR_Warranty_${claim.warrantyNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(new AppError(`Failed to generate PDF: ${(error as Error).message}`, 500));
  }
};
