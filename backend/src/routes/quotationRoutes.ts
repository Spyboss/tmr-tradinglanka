import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../auth/auth.middleware.js';
import { resolveAbility } from '../permissions/index.js';
import * as quotationService from '../services/quotation.service.js';

const router = express.Router();

/**
 * Thin routes: authenticate -> resolve ability once -> quotation service
 * (owns model access + authorization via permissions source of truth).
 * Response envelopes kept byte-compatible with the historic contract
 * ({ error, details } shapes and original message strings).
 */

const sendError = (res: Response, error: unknown): void => {
  const err = error as { statusCode?: number; message?: string; details?: string };
  const body: Record<string, string> = { error: err.message ?? 'Unexpected error' };
  if (err.details) body.details = err.details;
  res.status(err.statusCode ?? 500).json(body);
};

// Get all quotations with pagination and filtering
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const result = await quotationService.listQuotations(ability, req.query);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
});

// Get quotation by ID (ownership-scoped)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const quotation = await quotationService.getQuotation(ability, req.params.id);
    res.status(200).json(quotation);
  } catch (error) {
    sendError(res, error);
  }
});

// Create new quotation
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const quotation = await quotationService.createQuotation(
      ability,
      req.user?.id ?? '',
      req.body
    );
    res.status(201).json(quotation);
  } catch (error) {
    sendError(res, error);
  }
});

// Update quotation (ownership-scoped; owner reassignment = admin only)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const updated = await quotationService.updateQuotation(
      ability,
      req.params.id,
      req.body
    );
    res.status(200).json(updated);
  } catch (error) {
    sendError(res, error);
  }
});

// Delete quotation (ownership-scoped)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    await quotationService.deleteQuotation(ability, req.params.id);
    res.status(200).json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});

// Generate PDF for a quotation (ownership-scoped)
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const { buffer, filename } = await quotationService.getQuotationPdf(
      ability,
      req.params.id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    sendError(res, error);
  }
});

// Convert quotation to invoice (ownership-scoped)
router.post(
  '/:id/convert-to-invoice',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const ability = await resolveAbility(req);
      const invoice = await quotationService.convertToInvoice(
        ability,
        req.user?.id ?? '',
        req.params.id
      );
      res.status(201).json(invoice);
    } catch (error) {
      sendError(res, error);
    }
  }
);

// Get customer suggestions from existing bills (bill-readability scoped)
router.get(
  '/customers/suggestions',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const ability = await resolveAbility(req);
      const customers = await quotationService.suggestCustomers(
        ability,
        req.query.search
      );
      res.status(200).json(customers);
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
