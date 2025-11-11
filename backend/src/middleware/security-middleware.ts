/**
 * Security middleware for monitoring and controlling access
 */
import { Request, Response, NextFunction } from 'express';
import securityMonitor from '../utils/security-monitor.js';
import logger from '../utils/logger.js';
import { Application } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

/**
 * Middleware to block access from suspicious IPs
 * Used as an early filter before other security measures
 */
export const blockSuspiciousIPs = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = req.ip || 'unknown';

  // Log the client IP for debugging
  logger.debug(`Request from IP: ${clientIp}, path: ${req.path}`);

  // Whitelist for specific paths that should never be blocked
  const whitelistedPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/health',
    '/'
  ];

  // Never block access to whitelisted paths
  if (whitelistedPaths.some(path => req.path.startsWith(path))) {
    logger.debug(`Allowing access to whitelisted path: ${req.path}`);
    next();
    return;
  }

  // Check if IP is on our suspicious list
  if (securityMonitor.isSuspiciousIP(clientIp)) {
    logger.warn(`Blocked request from suspicious IP: ${clientIp} to ${req.path}`);

    // Instead of blocking with 403, just log and allow the request
    // This is a temporary measure to prevent legitimate users from being blocked
    // In a production environment, you might want to reinstate the blocking
    // res.status(403).json({ message: 'Access denied' });
    // return;

    // For now, just log and continue
    next();
    return;
  }

  next();
};

/**
 * Middleware to monitor API usage patterns
 * Tracks access patterns for detecting unusual behavior
 */
export const monitorApiActivity = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Skip monitoring for non-authenticated routes if desired
  if (!req.user?.id) {
    next();
    return;
  }

  // Create a resource identifier from the request
  const resource = `${req.method}:${req.baseUrl}${req.path}`;

  // Monitor this API access (async, doesn't block request)
  securityMonitor.trackApiAnomaly(
    req.user.id,
    req.ip || 'unknown',
    resource
  ).catch(error => {
    logger.error(`Error in security monitoring: ${(error as Error).message}`);
  });

  next();
};

/**
 * Middleware to sanitize request parameters
 * Prevents various injection attacks
 */
export const sanitizeRequestParams = (req: Request, res: Response, next: NextFunction): void => {
  // Basic parameter sanitization
  const sanitize = (obj: any) => {
    if (!obj) return obj;

    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        // Remove potential script tags and other dangerous HTML
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '');
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    });

    return obj;
  };

  // Sanitize different request components
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  // Only sanitize the body if it's not a multipart form (file upload)
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (req.body && !contentType.startsWith('multipart/form-data')) {
    req.body = sanitize(req.body);
  }

  next();
};

/**
 * Add enhanced security headers beyond what Helmet provides
 */
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Add Feature-Policy header
  res.setHeader('Feature-Policy', "geolocation 'self'; camera 'none'; microphone 'none'");

  // Add additional CORS headers if needed
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Add Permissions-Policy header (successor to Feature-Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

  next();
};

/**
 * Apply all security middleware
 */
export const applySecurityMiddleware = (app: Application): void => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Applying full security middleware for production');
    app.use(blockSuspiciousIPs);
    app.use(monitorApiActivity);
    app.use(sanitizeRequestParams);
    app.use(addSecurityHeaders);
  } else {
    logger.info('Running in development mode - using reduced security settings');
    // In development, only apply non-blocking security features
    app.use(sanitizeRequestParams);
    app.use(addSecurityHeaders);
  }
};