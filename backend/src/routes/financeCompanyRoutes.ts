import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../auth/auth.middleware.js';
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

export default router;
