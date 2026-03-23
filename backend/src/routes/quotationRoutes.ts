import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import Quotation from '../models/Quotation.js';
import Bill from '../models/Bill.js';
import { generateQuotationPDF } from '../services/quotationPdfService.js';
import { authenticate, requireAdmin, AuthRequest } from '../auth/auth.middleware.js';

const router = express.Router();
const MAX_SEARCH_LENGTH = 64;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get all quotations with pagination and filtering - Protected route
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search, type } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      // Regular users can only see their own quotations
      filter.owner = req.user.id;
    }

    // Add status filter
    if (status) {
      filter.status = status;
    }

    // Add type filter
    if (type) {
      filter.type = type;
    }

    // Add search filter
    if (search) {
      const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
      const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
      filter.$or = [
        { quotationNumber: { $regex: safeSearchRegex } },
        { customerName: { $regex: safeSearchRegex } },
        { claimNumber: { $regex: safeSearchRegex } }
      ];
    }

    const quotations = await Quotation.find(filter)
      .populate('referenceBillId', 'billNumber customerName')
      .sort({ quotationDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Quotation.countDocuments(filter);

    res.status(200).json({
      quotations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get quotation by ID - Protected route with ownership check
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('referenceBillId', 'billNumber customerName customerNIC customerAddress');

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = quotation.owner && quotation.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to view this quotation' });
    }

    res.status(200).json(quotation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create new quotation - Protected route
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotationData = req.body;
    
    // Set the owner as the current authenticated user
    quotationData.owner = req.user?.id;

    // If referenceBillId is provided, populate customer data from the bill
    if (quotationData.referenceBillId) {
      const referenceBill = await Bill.findById(quotationData.referenceBillId);
      if (referenceBill) {
        quotationData.customerName = quotationData.customerName || referenceBill.customerName;
        quotationData.customerNIC = quotationData.customerNIC || referenceBill.customerNIC;
        quotationData.customerAddress = quotationData.customerAddress || referenceBill.customerAddress;
      }
    }

    // Validate required fields
    if (!quotationData.customerName || !quotationData.customerAddress || !quotationData.items || !quotationData.items.length) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Customer name, address, and at least one item are required'
      });
    }

    // Validate items
    for (const item of quotationData.items) {
      if (!item.description || !item.quantity || !item.rate) {
        return res.status(400).json({
          error: 'Invalid item data',
          details: 'Each item must have a description, quantity, and rate'
        });
      }
    }

    const quotation = new Quotation(quotationData);
    await quotation.save();

    res.status(201).json(quotation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update quotation - Protected route with ownership check
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // First check ownership
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = quotation.owner && quotation.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to update this quotation' });
    }

    // Don't allow changing the owner
    if (req.body.owner && !isAdmin) {
      delete req.body.owner;
    }

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('referenceBillId', 'billNumber customerName');

    res.status(200).json(updatedQuotation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete quotation - Protected route with ownership check
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = quotation.owner && quotation.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this quotation' });
    }

    await Quotation.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Generate PDF for a quotation - Protected route with ownership check
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('referenceBillId', 'billNumber customerName');

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = quotation.owner && quotation.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to view this quotation' });
    }

    const pdfBuffer = await generateQuotationPDF(quotation);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=GM_${quotation.type}_${quotation.quotationNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Convert quotation to invoice - Protected route with ownership check
router.post('/:id/convert-to-invoice', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Check ownership or admin status
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';
    const isOwner = quotation.owner && quotation.owner.toString() === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to convert this quotation' });
    }

    if (quotation.type === 'invoice') {
      return res.status(400).json({ error: 'This is already an invoice' });
    }

    // Create new invoice from quotation
    const invoiceData = {
      ...quotation.toObject(),
      _id: undefined,
      quotationNumber: undefined, // Will be auto-generated with INV prefix
      type: 'invoice',
      status: 'sent',
      owner: req.user?.id
    };

    const invoice = new Quotation(invoiceData);
    await invoice.save();

    // Update original quotation status
    quotation.status = 'converted';
    await quotation.save();

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get customer suggestions from existing bills
router.get('/customers/suggestions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    
    const filter: any = {};
    
    // Filter by owner if not admin
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && req.user?.id) {
      filter.owner = req.user.id;
    }

    if (search) {
      const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
      const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
      filter.$or = [
        { customerName: { $regex: safeSearchRegex } },
        { customerNIC: { $regex: safeSearchRegex } }
      ];
    }

    const customers = await Bill.find(filter)
      .select('_id billNumber customerName customerNIC customerAddress')
      .limit(10)
      .sort({ createdAt: -1 });

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
