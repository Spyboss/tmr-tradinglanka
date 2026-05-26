import express, { Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../auth/auth.middleware.js';
import FinanceCompany from '../models/FinanceCompany.js';

const router = express.Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const companies = await FinanceCompany.find().sort({ name: 1 });
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, contact } = req.body;
    if (!name || !address || !contact) {
      res.status(400).json({ error: 'Name, address, and contact are required' });
      return;
    }
    const company = await FinanceCompany.create({ name, address, contact });
    res.status(201).json(company);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'A finance company with this name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, contact } = req.body;
    if (!name || !address || !contact) {
      res.status(400).json({ error: 'Name, address, and contact are required' });
      return;
    }
    const company = await FinanceCompany.findByIdAndUpdate(
      req.params.id,
      { name, address, contact },
      { new: true, runValidators: true }
    );
    if (!company) {
      res.status(404).json({ error: 'Finance company not found' });
      return;
    }
    res.status(200).json(company);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'A finance company with this name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const company = await FinanceCompany.findByIdAndDelete(req.params.id);
    if (!company) {
      res.status(404).json({ error: 'Finance company not found' });
      return;
    }
    res.status(200).json({ message: 'Finance company deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
