import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import Bill from '../models/Bill.js';
import { connectToDatabase } from '../config/database.js';
import { generatePDF } from '../services/pdfService.js';
import { authenticate, requireAdmin, requireOwnership, AuthRequest } from '../auth/auth.middleware.js';
import { createBill, updateBillStatus } from '../controllers/billController.js';
import { updateBill } from '../controllers/billUpdateController.js';

const router = express.Router();

// Get all bills with pagination and filtering - Protected route
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
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

    // Add search query if provided
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerNIC: { $regex: search, $options: 'i' } },
        { billNumber: { $regex: search, $options: 'i' } },
        { bikeModel: { $regex: search, $options: 'i' } }
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
router.put('/:id', authenticate, updateBill);

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
