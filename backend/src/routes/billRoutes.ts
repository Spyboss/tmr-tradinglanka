import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import Bill from '../models/Bill.js';
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js';
import { connectToDatabase } from '../config/database.js';
import { generatePDF } from '../services/pdfService.js';
import { generateProformaPDF } from '../services/proformaPdfService.js';
import { authenticate, requireAdmin, requireOwnership, AuthRequest } from '../auth/auth.middleware.js';
import { createBill, updateBillStatus } from '../controllers/billController.js';

const router = express.Router();
const SRI_LANKA_MOBILE_REGEX = /^07\d{8}$/;

const PROFORMA_TYPES = new Set(['leasing', 'finance', 'insurance']);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseIssueDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const ensureBillAccess = async (req: AuthRequest, res: Response, id: string) => {
  const bill = await Bill.findById(id);
  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return null;
  }

  const user = await req.app.locals.models?.User.findById(req.user?.id);
  const isAdmin = user?.role === 'admin';
  const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'You do not have permission to view this bill' });
    return null;
  }

  return bill;
};

const buildDefaultProforma = (bill: any) => {
  const unitPrice = Number(bill.bikePrice || 0);
  const downPayment = Number(bill.downPayment || 0);
  const amountToBeLeased = Math.max(unitPrice - downPayment, 0);
  
  const today = new Date();
  const day = today.getUTCDate().toString().padStart(2, '0');
  const month = (today.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = today.getUTCFullYear().toString().slice(-2);
  const dateStr = `${day}${month}${year}`;
  
  const billIdPart = (bill.billNumber || bill.bill_number || String(bill._id)).replace(/^(PF-|BILL-)/i, '');
  const docNum = `PF-${dateStr}-${billIdPart}`;
  
  return {
    type: 'leasing',
    documentNumber: docNum,
    issueDate: bill.billDate || today.toISOString(),
    financeCompanyName: '',
    financeCompanyAddress: '',
    financeCompanyContact: '',
    customerContact: bill.customerPhone || '',
    manufactureYear: '',
    color: '',
    motorPower: '',
    unitPrice,
    downPayment,
    amountToBeLeased
  };
};

const normalizeProformaPayload = (input: any, fallback: any) => {
  const type = toTrimmedString(input?.type)?.toLowerCase();
  const normalizedType = type && PROFORMA_TYPES.has(type) ? type : (fallback?.type || 'leasing');

  const unitPrice = toNumberOrUndefined(input?.unitPrice) ?? toNumberOrUndefined(fallback?.unitPrice) ?? 0;
  const downPayment = toNumberOrUndefined(input?.downPayment) ?? toNumberOrUndefined(fallback?.downPayment) ?? 0;

  const providedAmount = toNumberOrUndefined(input?.amountToBeLeased);
  const amountToBeLeased = providedAmount ?? Math.max(unitPrice - downPayment, 0);

  const issueDateRaw = input?.issueDate || fallback?.issueDate;
  const issueDate = parseIssueDate(issueDateRaw) ?? new Date();

  if (Number.isNaN(issueDate.getTime())) {
    throw new Error('Invalid issue date');
  }

  return {
    type: normalizedType,
    documentNumber: toTrimmedString(input?.documentNumber) || toTrimmedString(fallback?.documentNumber),
    issueDate,
    financeCompanyName: toTrimmedString(input?.financeCompanyName) || '',
    financeCompanyAddress: toTrimmedString(input?.financeCompanyAddress) || '',
    financeCompanyContact: toTrimmedString(input?.financeCompanyContact) || '',
    customerContact: toTrimmedString(input?.customerContact) || '',
    manufactureYear: toTrimmedString(input?.manufactureYear) || '',
    color: toTrimmedString(input?.color) || '',
    motorPower: toTrimmedString(input?.motorPower) || '',
    unitPrice,
    downPayment,
    amountToBeLeased,
    updatedAt: new Date()
  };
};

const calculateCompletedSaleAmounts = (bill: any) => {
  const bikePrice = Number(bill.bikePrice || 0);
  const rmvCharge = Number(bill.rmvCharge || 0);

  if (bill.billType === 'leasing') {
    return {
      totalAmount: Number(bill.downPayment || 0),
      rmvCharge: rmvCharge || 13500
    };
  }

  if (bill.isEbicycle || bill.isTricycle) {
    return {
      totalAmount: bikePrice,
      rmvCharge: 0
    };
  }

  return {
    totalAmount: bikePrice + (rmvCharge || 13000),
    rmvCharge: rmvCharge || 13000
  };
};

// Get all bills with pagination and filtering - Protected route
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search, startDate, endDate, minAmount, maxAmount, billType } = req.query as any;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      // Regular users can only see their own bills
      filter.owner = req.user.id;
    }

    if (status) filter.status = status;
    if (billType === 'advance') {
      filter.isAdvancePayment = true;
    } else if (billType) {
      filter.billType = billType;
      filter.isAdvancePayment = { $ne: true };
    }

    if (startDate || endDate) {
      const range: any = {};
      if (startDate) range.$gte = new Date(String(startDate));
      if (endDate) range.$lte = new Date(String(endDate));
      filter.billDate = range;
    }

    if (minAmount || maxAmount) {
      const amountRange: any = {};
      if (minAmount) amountRange.$gte = Number(minAmount);
      if (maxAmount) amountRange.$lte = Number(maxAmount);
      filter.totalAmount = amountRange;
    }

    // Add search query if provided
    if (search) {
      const tokens = String(search).split(/\s+/).filter(Boolean);
      const regexes = tokens.map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      filter.$or = [
        { customerName: { $in: regexes } },
        { customerNIC: { $in: regexes } },
        { billNumber: { $in: regexes } },
        { bikeModel: { $in: regexes } }
      ];
    }

    // Execute query with pagination
    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Bill.countDocuments(filter);

    res.status(200).json({
      bills,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/suggestions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q = '' } = req.query as any;
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const ownerFilter: any = {};
    if (!isAdmin && req.user?.id) ownerFilter.owner = req.user.id;
    const regex = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const customers = await Bill.aggregate([
      { $match: { ...ownerFilter, customerName: { $regex: regex } } },
      { $group: { _id: '$customerName' } },
      { $limit: 5 }
    ]);
    const billNumbers = await Bill.aggregate([
      { $match: { ...ownerFilter, billNumber: { $regex: regex } } },
      { $group: { _id: '$billNumber' } },
      { $limit: 5 }
    ]);
    const models = await Bill.aggregate([
      { $match: { ...ownerFilter, bikeModel: { $regex: regex } } },
      { $group: { _id: '$bikeModel' } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      customers: customers.map(c => c._id).filter(Boolean),
      billNumbers: billNumbers.map(b => b._id).filter(Boolean),
      models: models.map(m => m._id).filter(Boolean)
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get bill by ID - Protected route with ownership check
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to view this bill' });
    }

    res.status(200).json(bill);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create new bill - Protected route
router.post('/', authenticate, createBill);

// Update bill - Protected route with ownership check
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // First check ownership
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to update this bill' });
    }

    // Don't allow changing the owner
    if (req.body.owner && !isAdmin) {
      delete req.body.owner;
    }

    const willBeAdvance = req.body.isAdvancePayment === true || (req.body.isAdvancePayment === undefined && bill.isAdvancePayment === true);
    const hasIncomingPhone = typeof req.body.customerPhone === 'string';
    const normalizedIncomingPhone = hasIncomingPhone
      ? req.body.customerPhone.trim()
      : undefined;
    const nextPhone = hasIncomingPhone
      ? (normalizedIncomingPhone || undefined)
      : bill.customerPhone;

    if (willBeAdvance && !nextPhone) {
      return res.status(400).json({
        error: 'Customer contact number is required for advance payments (format: 07XXXXXXXX)'
      });
    }

    if (nextPhone && !SRI_LANKA_MOBILE_REGEX.test(nextPhone)) {
      return res.status(400).json({
        error: 'Customer contact number must be in 07XXXXXXXX format'
      });
    }

    if (hasIncomingPhone) {
      req.body.customerPhone = nextPhone;
    }

    Object.entries(req.body).forEach(([key, value]) => {
      (bill as any).set(key, value);
    });

    const updatedBill = await bill.save();

    res.status(200).json(updatedBill);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/close-sale', authenticate, async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findById(req.params.id).session(session);

    if (!bill) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Bill not found' });
    }

    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'You do not have permission to close this sale' });
    }

    if (!bill.isAdvancePayment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Only advance bills can be closed as a final sale' });
    }

    if ((bill.status || '').toLowerCase() === 'converted') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'This advance bill has already been converted to a final sale' });
    }

    const { totalAmount, rmvCharge } = calculateCompletedSaleAmounts(bill);
    const finalBill = new Bill({
      owner: bill.owner,
      customerName: bill.customerName,
      customerNIC: bill.customerNIC,
      customerAddress: bill.customerAddress,
      customerPhone: bill.customerPhone,
      bikeModel: bill.bikeModel,
      motorNumber: bill.motorNumber,
      chassisNumber: bill.chassisNumber,
      bikePrice: bill.bikePrice,
      vehicleType: bill.vehicleType,
      inventoryItemId: bill.inventoryItemId,
      billType: bill.billType,
      isEbicycle: bill.isEbicycle,
      isTricycle: bill.isTricycle,
      rmvCharge,
      downPayment: bill.downPayment,
      isAdvancePayment: false,
      advanceAmount: undefined,
      balanceAmount: 0,
      estimatedDeliveryDate: bill.estimatedDeliveryDate,
      isFirstTricycleSale: bill.isFirstTricycleSale,
      totalAmount,
      billDate: new Date(),
      status: 'completed',
      originalAdvanceBillId: bill._id
    });

    await finalBill.save({ session });

    bill.status = 'converted';
    bill.finalBillId = finalBill._id;
    await bill.save({ session });

    if (bill.inventoryItemId) {
      await BikeInventory.findByIdAndUpdate(
        bill.inventoryItemId,
        {
          status: BikeStatus.SOLD,
          dateSold: new Date(),
          billId: finalBill._id
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Final sale bill created successfully',
      advanceBillId: bill._id,
      finalBill
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete bill - Protected route with ownership check
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // First check ownership
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this bill' });
    }

    if (!isAdmin && (bill.status || '').toLowerCase() !== 'cancelled') {
      return res.status(400).json({ error: 'Cancel this bill before deleting it' });
    }

    await Bill.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get proforma payload for a completed bill
router.get('/:id/proforma', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bill = await ensureBillAccess(req, res, req.params.id);
    if (!bill) return;

    const fallback = buildDefaultProforma(bill);
    const proforma = { ...fallback, ...(bill.proforma || {}) };

    res.status(200).json({
      billId: bill._id,
      status: bill.status,
      proforma
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Save/Update proforma payload for a completed bill
router.put('/:id/proforma', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bill = await ensureBillAccess(req, res, req.params.id);
    if (!bill) return;

    if ((bill.status || '').toLowerCase() !== 'completed') {
      return res.status(400).json({ error: 'Proforma invoice is only available for completed bills' });
    }

    const fallback = { ...buildDefaultProforma(bill), ...(bill.proforma || {}) };
    const normalized = normalizeProformaPayload(req.body, fallback);

    if (!normalized.financeCompanyName || !normalized.financeCompanyAddress || !normalized.financeCompanyContact) {
      return res.status(400).json({
        error: 'Leasing/Finance company name, address, and contact number are required'
      });
    }

    bill.proforma = normalized;
    await bill.save();

    res.status(200).json({
      message: 'Proforma details saved successfully',
      proforma: bill.proforma
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Generate proforma PDF for a completed bill
router.get('/:id/proforma/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bill = await ensureBillAccess(req, res, req.params.id);
    if (!bill) return;

    if ((bill.status || '').toLowerCase() !== 'completed') {
      return res.status(400).json({ error: 'Proforma invoice is only available for completed bills' });
    }

    const fallback = buildDefaultProforma(bill);
    const proforma = { ...fallback, ...(bill.proforma || {}) };

    if (!proforma.financeCompanyName || !proforma.financeCompanyAddress || !proforma.financeCompanyContact) {
      return res.status(400).json({
        error: 'Complete proforma details before generating PDF (finance company name, address, and contact are required)'
      });
    }

    const pdfBuffer = await generateProformaPDF({
      ...(bill.toObject ? bill.toObject() : bill),
      proforma
    });

    const fileId = proforma.documentNumber || bill.billNumber || bill.bill_number || bill._id;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=TMR_Proforma_${fileId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Generate PDF for a bill - Protected route with ownership check
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to view this bill' });
    }

    const pdfBuffer = await generatePDF(bill);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=TMR_Bill_${bill.billNumber || bill.bill_number || bill._id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Preview PDF with sample data - Protected route
router.get('/preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sampleBill: any = {
      billNumber: 'PREVIEW-0001',
      billDate: new Date().toISOString().slice(0, 10),
      customerName: 'Sample Customer',
      customerNIC: '000000000V',
      customerAddress: '123, Sample Street, City',
      bikeModel: 'E-MOTORCYCLE X1',
      vehicleType: 'E-MOTORCYCLE',
      motorNumber: 'MTR123456',
      chassisNumber: 'CHS123456',
      rmvCharge: 0,
      downPayment: 100000,
      totalAmount: 450000,
      isAdvancePayment: true,
      advanceAmount: 100000,
      balanceAmount: 350000,
      billType: 'cash'
    };

    const pdfBuffer = await generatePDF(sampleBill);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=GM_Bill_Preview.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Preview PDF from query param formData (JSON string) - Protected route
router.get('/preview/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { formData } = req.query as { formData?: string };
    let billData: any = {};

    if (formData) {
      try {
        billData = JSON.parse(formData);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid formData JSON' });
      }
    }

    const pdfBuffer = await generatePDF(billData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=GM_Bill_Preview.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Preview PDF from POST body - Protected route
router.post('/preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const billData = req.body;
    const pdfBuffer = await generatePDF(billData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=GM_Bill_Preview.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update bill status - Protected route with ownership check
router.patch('/:id/status', authenticate, updateBillStatus);

export default router;
