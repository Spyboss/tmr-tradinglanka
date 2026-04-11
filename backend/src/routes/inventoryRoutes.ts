import { Router } from 'express';
import {
  getAllInventory,
  getInventoryById,
  addToInventory,
  batchAddToInventory,
  updateInventory,
  deleteInventory,
  getInventorySummary,
  getInventoryAnalytics,
  getInventoryReportAnalytics,
  getAvailableBikesByModel,
  generateInventoryReportPDF
} from '../controllers/bikeInventoryController.js';
import { authenticate, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/inventory
 * @desc    Get all inventory items with filtering
 * @access  Private
 */
router.get('/', getAllInventory);

/**
 * @route   GET /api/inventory/summary
 * @desc    Get inventory summary by model
 * @access  Private
 */
router.get('/summary', getInventorySummary);

/**
 * @route   GET /api/inventory/analytics
 * @desc    Get enhanced inventory analytics for professional reporting
 * @access  Private
 */
router.get('/analytics', getInventoryAnalytics);

/**
 * @route   GET /api/inventory/report/analytics
 * @desc    Get focused analytics for the inventory report dashboard
 * @access  Private
 */
router.get('/report/analytics', getInventoryReportAnalytics);

/**
 * @route   GET /api/inventory/report/pdf
 * @desc    Generate PDF report for inventory
 * @access  Private
 */
router.get('/report/pdf', generateInventoryReportPDF);

/**
 * @route   GET /api/inventory/available/:modelId
 * @desc    Get available bikes for a specific model
 * @access  Private
 */
router.get('/available/:modelId', getAvailableBikesByModel);

/**
 * @route   GET /api/inventory/:id
 * @desc    Get inventory item by ID
 * @access  Private
 */
router.get('/:id', getInventoryById);

/**
 * @route   POST /api/inventory
 * @desc    Add a bike to inventory
 * @access  Private
 */
router.post('/', addToInventory);

/**
 * @route   POST /api/inventory/batch
 * @desc    Add multiple bikes to inventory
 * @access  Private
 */
router.post('/batch', batchAddToInventory);

/**
 * @route   PUT /api/inventory/:id
 * @desc    Update an inventory item
 * @access  Private
 */
router.put('/:id', updateInventory);

/**
 * @route   DELETE /api/inventory/:id
 * @desc    Delete an inventory item
 * @access  Private (Admin only)
 */
router.delete('/:id', requireAdmin, deleteInventory);

export default router;
