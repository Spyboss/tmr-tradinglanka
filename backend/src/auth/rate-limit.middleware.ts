import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterRes, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Create a Redis-backed rate limiter
 */
const createRedisRateLimiter = (opts: {
  keyPrefix: string;
  points: number;
  duration: number;
  blockDuration?: number;
}) => {
  const redis = getRedisClient();

  // Fallback memory limiter in case Redis is down
  const insuranceLimiter = new RateLimiterMemory({
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration
  });

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

// General API rate limiter: 300 requests per minute in production, 500 in development
const apiLimiter = createRedisRateLimiter({
  keyPrefix: 'rl:api',
  points: process.env.NODE_ENV === 'production' ? 300 : 500, // Increased limits
  duration: 60, // Per 60 seconds
});

// Login specific rate limiter: 10 attempts per minute in production, 20 in development
const loginLimiter = createRedisRateLimiter({
  keyPrefix: 'rl:login',
  points: process.env.NODE_ENV === 'production' ? 10 : 20, // Increased limits
  duration: 60, // Per minute
  blockDuration: process.env.NODE_ENV === 'production' ? 120 : 30, // Reduced block time
});

// Registration specific rate limiter: 5 per hour in production, 15 in development
const registrationLimiter = createRedisRateLimiter({
  keyPrefix: 'rl:register',
  points: process.env.NODE_ENV === 'production' ? 5 : 15, // Increased limits
  duration: process.env.NODE_ENV === 'production' ? 60 * 60 : 60 * 5, // Only 5 minutes in dev
  blockDuration: process.env.NODE_ENV === 'production' ? 30 * 60 : 60, // Reduced block time
});

/**
 * Check if an IP is a private/local network address
 */
const isPrivateIP = (ip: string): boolean => {
  // Check for localhost and common private network patterns
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  // Check for IPv4 private networks
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
      ip.startsWith('172.2') || ip.startsWith('172.30.') || ip.startsWith('172.31.')) {
    return true;
  }

  // Check for IPv6 private networks
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) {
    return true;
  }

  // Check for IPv4-mapped IPv6 addresses
  if (ip.startsWith('::ffff:')) {
    const ipv4Part = ip.substring(7);
    if (ipv4Part.startsWith('10.') || ipv4Part.startsWith('192.168.') ||
        (ipv4Part.startsWith('172.') && parseInt(ipv4Part.split('.')[1]) >= 16 && parseInt(ipv4Part.split('.')[1]) <= 31)) {
      return true;
    }

    // Check for localhost in IPv4-mapped IPv6
    if (ipv4Part === '127.0.0.1') {
      return true;
    }
  }

  return false;
};

/**
 * Apply general API rate limiting
 */
export const apiRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip rate limiting for development mode or private IPs
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const clientIp = req.ip || 'unknown';

  // Skip rate limiting for private IPs
  if (isPrivateIP(clientIp)) {
    return next();
  }

  // Log the IP for debugging
  logger.debug(`Rate limiting check for IP: ${clientIp} on ${req.method} ${req.path}`);

  // Use a normalized IP for rate limiting
  // For IPv6 addresses, we'll use just the first part to avoid blocking entire ranges
  let rateKey = clientIp;
  if (clientIp.includes(':')) {
    // For IPv6, just use the first 4 segments to avoid being too specific
    const parts = clientIp.split(':');
    rateKey = parts.slice(0, 4).join(':');
    logger.debug(`Using normalized IPv6 key for rate limiting: ${rateKey}`);
  }

  try {
    await apiLimiter.consume(rateKey);
    next();
  } catch (error) {
    // Check if error is from rate limiter
    const limiterRes = error as RateLimiterRes;
    const retryAfter = Math.ceil(limiterRes.msBeforeNext / 1000) || 60;

    // Set retry-after header
    res.set('Retry-After', String(retryAfter));

    logger.warn(`Rate limit exceeded for ${clientIp} (key: ${rateKey}) on ${req.method} ${req.path}`);
    // Enforce 429 in production; remain soft in non-production
    if ((process.env.NODE_ENV || 'development') === 'production') {
      res.status(429).json({
        message: 'Too many requests - please try again later',
        retryAfter
      });
      return;
    }
    next();
  }
};

/**
 * Apply specific login rate limiting
 */
export const loginRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip rate limiting for development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const clientIp = req.ip || 'unknown';

  // Skip rate limiting for private IPs
  if (isPrivateIP(clientIp)) {
    return next();
  }

  // Log the IP for debugging
  logger.debug(`Login rate limiting check for IP: ${clientIp}`);

  try {
    // Use normalized IP + email as identifier
    const email = (req.body.email || '').toLowerCase().trim();

    // Normalize IPv6 addresses
    let rateKey = clientIp;
    if (clientIp.includes(':')) {
      // For IPv6, just use the first 4 segments
      const parts = clientIp.split(':');
      rateKey = parts.slice(0, 4).join(':');
      logger.debug(`Using normalized IPv6 key for login rate limiting: ${rateKey}`);
    }

    const key = `${rateKey}:${email}`;

    await loginLimiter.consume(key);
    next();
  } catch (error) {
    // Check if error is from rate limiter
    const limiterRes = error as RateLimiterRes;
    const retryAfter = Math.ceil(limiterRes.msBeforeNext / 1000) || 120;

    // Set retry-after header
    res.set('Retry-After', String(retryAfter));

    logger.warn(`Login rate limit exceeded for ${clientIp}`);
    // Enforce 429 in production; remain soft in non-production
    if ((process.env.NODE_ENV || 'development') === 'production') {
      res.status(429).json({
        message: 'Too many login attempts - please try again later',
        retryAfter
      });
      return;
    }
    next();
  }
};

/**
 * Apply specific registration rate limiting
 */
export const registrationRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Skip rate limiting for development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const clientIp = req.ip || 'unknown';

  // Skip rate limiting for private IPs
  if (isPrivateIP(clientIp)) {
    return next();
  }

  // Log the IP for debugging
  logger.debug(`Registration rate limiting check for IP: ${clientIp}`);

  // Normalize IPv6 addresses
  let rateKey = clientIp;
  if (clientIp.includes(':')) {
    // For IPv6, just use the first 4 segments
    const parts = clientIp.split(':');
    rateKey = parts.slice(0, 4).join(':');
    logger.debug(`Using normalized IPv6 key for registration rate limiting: ${rateKey}`);
  }

  try {
    await registrationLimiter.consume(rateKey);
    next();
  } catch (error) {
    // Check if error is from rate limiter
    const limiterRes = error as RateLimiterRes;
    const retryAfter = Math.ceil(limiterRes.msBeforeNext / 1000) || 1800; // 30 minutes

    // Set retry-after header
    res.set('Retry-After', String(retryAfter));

    logger.warn(`Registration rate limit exceeded for ${clientIp} (key: ${rateKey})`);
    // Enforce 429 in production; remain soft in non-production
    if ((process.env.NODE_ENV || 'development') === 'production') {
      res.status(429).json({
        message: 'Too many registration attempts - please try again later',
        retryAfter
      });
      return;
    }
    next();
  }
};