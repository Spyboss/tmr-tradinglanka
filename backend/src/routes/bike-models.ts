import { Router } from 'express';
import { 
  getAllBikeModels, 
  getBikeModelById,
  createBikeModel,
  updateBikeModel,
  deleteBikeModel
} from '../controllers/bikeModelController.js';
import { authenticate } from '../auth/auth.middleware.js';
import { requirePermission } from '../permissions/index.js';

const router = Router();

/**
 * @route   GET /api/bike-models
 * @desc    Get all bike models
 * @access  Public
 */
router.get('/', getAllBikeModels);

/**
 * @route   GET /api/bike-models/:id
 * @desc    Get bike model by ID
 * @access  Public
 */
router.get('/:id', getBikeModelById);

/**
 * @route   POST /api/bike-models
 * @desc    Create a new bike model
 * @access  Private (Admin only)
 */
router.post('/', authenticate, requirePermission('manage', 'BikeModel'), createBikeModel);

/**
 * @route   PUT /api/bike-models/:id
 * @desc    Update a bike model
 * @access  Private (Admin only)
 */
router.put('/:id', authenticate, requirePermission('manage', 'BikeModel'), updateBikeModel);

/**
 * @route   DELETE /api/bike-models/:id
 * @desc    Delete a bike model
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticate, requirePermission('manage', 'BikeModel'), deleteBikeModel);

export default router;