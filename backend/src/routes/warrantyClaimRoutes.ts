import { Router } from 'express';
import {
  getAllWarrantyClaims,
  getWarrantyClaimById,
  getPrefillData,
  searchBills,
  createWarrantyClaim,
  updateWarrantyClaim,
  deleteWarrantyClaim,
  generateWarrantyClaimPDF
} from '../controllers/warrantyClaimController.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllWarrantyClaims);

router.get('/prefill', getPrefillData);

router.get('/search-bills', searchBills);

router.get('/:id', getWarrantyClaimById);

router.get('/:id/pdf', generateWarrantyClaimPDF);

router.post('/', createWarrantyClaim);

router.put('/:id', updateWarrantyClaim);

router.delete('/:id', deleteWarrantyClaim);

export default router;
