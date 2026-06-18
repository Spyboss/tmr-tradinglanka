import * as crypto from 'node:crypto';

// Import jose
import { SignJWT, jwtVerify } from 'jose';
import { getRedisClient } from '../config/redis.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import securityMonitor from '../utils/security-monitor.js';

// Helper to retrieve JWT secret as string and as Uint8Array
const getJWTSecretString = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return secret;
};

// 256-bit secret (32 chars) from env
const getSecret = () => new TextEncoder().encode(getJWTSecretString());

// Salted SHA-256 hash helper (prefix salt)
const saltedHash = (value: string): string => {
  const secret = getJWTSecretString();
  return crypto.createHash('sha256').update(secret + value).digest('hex');
};

// Feature flag to accept legacy refresh token keys (raw token stored in Redis)
const LEGACY_REFRESH_ACCEPT = (process.env.LEGACY_REFRESH_ACCEPT ?? 'true').toLowerCase() !== 'false';

// Environment-specific token settings
const ACCESS_TOKEN_EXPIRY = process.env.NODE_ENV === 'production' ? '60m' : '60m';
const REFRESH_TOKEN_EXPIRY_SECONDS = process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60; // 7 days in production, 30 days in development

/**
 * Create a short-lived JWT access token
 * @param userId User ID to include in the token
 * @returns Signed JWT token
 */
export const createToken = async (userId: string): Promise<string> => {
  const tokenId = crypto.randomBytes(32).toString('hex'); // 256-bit ID for revocation

  // Read the current tokenVersion from MongoDB (source of truth for revocation)
  // Legacy users (no tokenVersion field) default to version 0
  let tokenVersion = 0;
  try {
    const user = await User.findById(userId).select('tokenVersion').lean();
    tokenVersion = user?.tokenVersion ?? 0;
  } catch (error) {
    logger.error(`Failed to read tokenVersion for user ${userId}: ${(error as Error).message}`);
  }

  return await new SignJWT({
    sub: userId,
    jti: tokenId, // JWT ID for revocation
    tvn: tokenVersion // Token version for revocation checks
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000)) // Valid from now
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('tmr-api')
    .setAudience('tmr-client')
    .sign(getSecret());
};

/**
 * Create a refresh token for extended sessions
 * @param userId User ID to associate with the refresh token
 * @returns Secure random refresh token
 */
export const createRefreshToken = (userId: string): string => {
  const refreshToken = crypto.randomBytes(32).toString('hex');

  // Store refresh token in Redis with expiration
  try {
    const redis = getRedisClient();
    const tokenKey = `refresh:${saltedHash(refreshToken)}`;
    redis.set(tokenKey, userId, 'EX', REFRESH_TOKEN_EXPIRY_SECONDS).catch(error => {
      logger.error(`Failed to store refresh token: ${(error as Error).message}`);
    });
  } catch (error) {
    logger.error(`Redis error when storing refresh token: ${(error as Error).message}`);
  }

  return refreshToken;
};

/**
 * Verify a JWT token and check if it has been revoked
 * @param token JWT token to verify
 * @returns Payload if valid, throws error if invalid or revoked
 */
export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'tmr-api',
      audience: 'tmr-client',
    });

    if (!payload.sub) {
      throw new Error('Invalid token: missing subject claim');
    }

    // Check if token has been revoked (MongoDB source of truth, Redis cache)
    const isRevoked = await isTokenRevoked(payload.sub as string, payload.tvn as number | undefined);
    if (isRevoked) {
      // Track revoked token usage attempt
      securityMonitor.trackApiAnomaly(
        payload.sub as string,
        'unknown', // IP not available in this context
        `JWT_VERIFICATION:REVOKED_TOKEN:${payload.jti}`
      ).catch(error => {
        logger.error(`Error tracking revoked token usage: ${(error as Error).message}`);
      });

      throw new Error('Token has been revoked');
    }

    return payload;
  } catch (error) {
    logger.error(`Token verification error: ${(error as Error).message}`);
    throw new Error('Invalid token');
  }
};

/**
 * Check if a user's token has been revoked.
 * Uses Redis as a fast cache, falls back to MongoDB tokenVersion (source of truth).
 * Fails closed: denies access when neither Redis nor MongoDB is reachable.
 *
 * @param userId User ID to check
 * @param tokenVersion Token version from JWT claim (undefined for legacy tokens → treated as 0)
 * @returns True if token is revoked, false otherwise
 */
export const isTokenRevoked = async (userId: string, tokenVersion?: number): Promise<boolean> => {
  const jwtVersion = tokenVersion ?? 0;

  // Fast path: try Redis first
  let redisAvailable = true;
  try {
    const redis = getRedisClient();
    const userRevoked = await redis.get(`revoked:user:${userId}`);
    if (userRevoked) return true;
  } catch (error) {
    redisAvailable = false;
    logger.warn(`Redis unavailable for revocation check, falling back to MongoDB: ${(error as Error).message}`);
  }

  // If Redis was available and didn't find a revocation, token is valid
  if (redisAvailable) return false;

  // Fallback path: check tokenVersion from MongoDB (source of truth)
  try {
    const user = await User.findById(userId).select('tokenVersion').lean();
    // User deleted or missing → revoke all their tokens
    if (!user) return true;
    const dbVersion = user.tokenVersion ?? 0;
    return dbVersion > jwtVersion;
  } catch (error) {
    // Both Redis and MongoDB are unreachable → fail closed (deny access)
    logger.error(`Cannot verify revocation status — Redis and MongoDB both unavailable: ${(error as Error).message}`);
    return true;
  }
};

/**
 * Revoke all tokens for a user.
 * Increments tokenVersion in MongoDB (source of truth) and writes to Redis cache.
 *
 * @param userId User ID to revoke tokens for
 */
export const revokeTokens = async (userId: string): Promise<void> => {
  // MongoDB is the authoritative source of truth
  const result = await User.updateOne(
    { _id: userId },
    { $inc: { tokenVersion: 1 } }
  );

  if (result.matchedCount === 0) {
    logger.warn(`revokeTokens called for non-existent user ${userId}`);
    return;
  }

  logger.info(`Token version incremented for user ${userId}`);

  // Best-effort Redis cache update (non-fatal if it fails)
  try {
    const redis = getRedisClient();
    await redis.set(`revoked:user:${userId}`, Date.now().toString(), 'EX', 86400);
  } catch (error) {
    logger.warn(`Redis cache write failed during token revocation for ${userId}: ${(error as Error).message}`);
  }
};

/**
 * Verify a refresh token and get the associated user ID
 * @param refreshToken Refresh token to verify
 * @returns User ID if valid, null if invalid
 */
export const verifyRefreshToken = async (refreshToken: string): Promise<string | null> => {
  try {
    const redis = getRedisClient();
    // Check new hashed key first
    const hashedKey = `refresh:${saltedHash(refreshToken)}`;
    let userId = await redis.get(hashedKey);

    // Fallback to legacy raw token key if enabled
    if (!userId && LEGACY_REFRESH_ACCEPT) {
      userId = await redis.get(`refresh:${refreshToken}`);
    }

    // If no user ID found, token is invalid or expired
    if (!userId) {
      return null;
    }

    return userId;
  } catch (error) {
    logger.error(`Refresh token verification error: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Revoke a specific refresh token
 * @param refreshToken Refresh token to revoke
 */
export const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    // Attempt to delete both new hashed and legacy raw keys
    const hashedKey = `refresh:${saltedHash(refreshToken)}`;
    await redis.del(hashedKey);
    await redis.del(`refresh:${refreshToken}`);
  } catch (error) {
    logger.error(`Refresh token revocation error: ${(error as Error).message}`);
    throw new Error('Failed to revoke refresh token');
  }
};