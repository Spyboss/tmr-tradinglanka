import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import User, { UserRole } from '../models/User.js';
import logger from '../utils/logger.js';
import { isVerificationEnabled } from './verification.service.js';

// Frontend base URL used to guide users to the verification page
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'https://tmr-tradinglanka.pages.dev').replace(/\/$/, '');

// Flag gating and legacy cutoff (ISO 8601 string). No schema changes.
const EMAIL_VERIFICATION_ENFORCE = (process.env.EMAIL_VERIFICATION_ENFORCE ?? 'false').toLowerCase() === 'true';
const CUTOFF_ISO = process.env.EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO;
const LEGACY_CUTOFF_DATE = CUTOFF_ISO ? new Date(CUTOFF_ISO) : null;

const isLegacyUser = (createdAt?: Date | null): boolean => {
  if (!LEGACY_CUTOFF_DATE || !createdAt) return false;
  return createdAt.getTime() < LEGACY_CUTOFF_DATE.getTime();
};

/**
 * Enforcement middleware: returns friendly 403 for non-verified users when enabled.
 * - Bypasses when enforcement is disabled or verification feature is disabled
 * - Bypasses for admin role and legacy users (created before cutoff)
 * - Safe fail-open on errors
 */
export const enforceVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Do not enforce if flag is off or feature disabled
    if (!EMAIL_VERIFICATION_ENFORCE || !isVerificationEnabled()) {
      next();
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      // Should only run after authenticate; fail-open if missing
      next();
      return;
    }

    const user = await User.findById(userId).select('role createdAt').lean();
    if (!user) {
      next();
      return;
    }

    // Admins are always bypassed
    if (user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Legacy users (created before cutoff) are bypassed
    if (isLegacyUser(user.createdAt)) {
      next();
      return;
    }

    // Check verification status
    const { default: EmailVerificationStatus } = await import('../models/EmailVerificationStatus.js');
    const status = await EmailVerificationStatus.findOne({ user: userId }).lean();
    const verified = !!status?.verified;

    if (verified) {
      next();
      return;
    }

    // Friendly 403 response aligned with frontend interceptor expectations
    res.status(403).json({
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      friendly: true,
      verifyUrl: `${PUBLIC_BASE_URL}/verify`,
      enabled: true
    });
  } catch (error) {
    logger.error(`enforceVerification error: ${(error as Error).message}`);
    // Fail-open on any error
    next();
  }
};