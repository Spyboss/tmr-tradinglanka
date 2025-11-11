import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

const createRedisRateLimiter = (opts: { keyPrefix: string; points: number; duration: number; blockDuration?: number; }) => {
  const redis = getRedisClient();
  const insuranceLimiter = new RateLimiterMemory({ points: opts.points, duration: opts.duration, blockDuration: opts.blockDuration });
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: opts.keyPrefix,
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration,
    inMemoryBlockOnConsumed: opts.points,
    inMemoryBlockDuration: opts.blockDuration || 0,
    insuranceLimiter
  });
};

const verifyLimiter = createRedisRateLimiter({
  keyPrefix: 'rl:verify',
  points: process.env.NODE_ENV === 'production' ? 10 : 30,
  duration: process.env.NODE_ENV === 'production' ? 15 * 60 : 5 * 60,
  blockDuration: process.env.NODE_ENV === 'production' ? 60 : 30,
});

export const verifyRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (process.env.NODE_ENV === 'development') return next();
  const clientIp = req.ip || 'unknown';
  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    const key = `${clientIp}:${email}`;
    await verifyLimiter.consume(key);
    next();
  } catch (error) {
    const limiterRes = error as RateLimiterRes;
    const retryAfter = Math.ceil(limiterRes.msBeforeNext / 1000) || 60;
    res.set('Retry-After', String(retryAfter));
    logger.warn(`Verification rate limit exceeded for ${clientIp}`);
    // Enforce 429 in production; remain soft in non-production
    if ((process.env.NODE_ENV || 'development') === 'production') {
      res.status(429).json({
        message: 'Too many verification attempts - please try again later',
        retryAfter
      });
      return;
    }
    next();
  }
};