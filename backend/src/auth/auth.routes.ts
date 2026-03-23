import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { enforceVerification } from './verification-enforce.middleware.js';
import { validateRegistration, validateLogin } from './auth.validation.js';
import { loginRateLimit, registrationRateLimit, createAdminRateLimit } from './rate-limit.middleware.js';
import * as verificationController from './verification.controller.js';
import { verifyRateLimit } from './verify-rate-limit.middleware.js';
import {
  validateProfileUpdate,
  validatePasswordChange
} from '../middleware/userValidation.middleware.js';

const router = Router();

/**
 * @route  POST /api/auth/register
 * @desc   Register a new user
 * @access Public
 */
router.post('/register', registrationRateLimit, validateRegistration, authController.register);

/**
 * @route  POST /api/auth/login
 * @desc   Login user and return JWT and refresh token
 * @access Public
 */
router.post('/login', loginRateLimit, validateLogin, authController.login);

/**
 * @route  POST /api/auth/refresh
 * @desc   Refresh access token using refresh token
 * @access Public (with refresh token cookie)
 */
router.post('/refresh', authController.refreshAccessToken);

/**
 * @route  POST /api/auth/logout
 * @desc   Logout user and invalidate refresh token
 * @access Public (with refresh token cookie)
 */
router.post('/logout', authController.logout);

/**
 * @route  GET /api/auth/me
 * @desc   Get current user information
 * @access Private
 */
router.get('/me', authenticate, enforceVerification, authController.getCurrentUser);

/**
 * @route  PUT /api/auth/profile
 * @desc   Update user profile information
 * @access Private
 */
router.put('/profile', authenticate, enforceVerification, validateProfileUpdate, authController.updateProfile);

/**
 * @route  PUT /api/auth/password
 * @desc   Change user password
 * @access Private
 */
router.put('/password', authenticate, enforceVerification, validatePasswordChange, authController.changePassword);

/**
 * @route  POST /api/auth/create-admin
 * @desc   Create an admin user (protected by setup key)
 * @access Public (but protected by setup key)
 */
router.post('/create-admin', createAdminRateLimit, authController.createAdmin);

/**
 * @route  POST /api/auth/verify/request
 * @desc   Request email verification (no-op if disabled)
 * @access Public
 */
router.post('/verify/request', verifyRateLimit, verificationController.requestVerification);

/**
 * @route  POST /api/auth/verify/confirm
 * @desc   Confirm email verification (no-op if disabled)
 * @access Public
 */
router.post('/verify/confirm', verifyRateLimit, verificationController.confirmVerification);

/**
 * @route  GET /api/auth/verify/status
 * @desc   Get current user's verification status (no enforcement)
 * @access Private
 */
router.get('/verify/status', authenticate, verificationController.getVerificationStatus);

export default router;
