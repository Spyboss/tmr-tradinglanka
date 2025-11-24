import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import Bill from '../models/Bill.js';
import { connectToDatabase } from '../config/database.js';
import { generatePDF } from '../services/pdfService.js';
import { authenticate, requireAdmin, requireOwnership, AuthRequest } from '../auth/auth.middleware.js';
import { createBill, updateBillStatus } from '../controllers/billController.js';

const router = express.Router();

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
    if (billType) filter.billType = billType;

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

    const updatedBill = await Bill.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedBill);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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

    await Bill.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Bill deleted successfully' });
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