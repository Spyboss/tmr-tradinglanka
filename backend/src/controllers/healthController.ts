import { Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';
import logger from '../utils/logger.js';

/**
 * Basic health check controller
 * Returns status 200 if server is running
 */
export const basicHealth = (req: Request, res: Response): void => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API is running' 
  });
};

/**
 * Detailed health check controller
 * Returns detailed health information about the server and database
 */
export const detailedHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    const healthInfo = {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      // Diagnostic: how Express resolves the caller's IP behind the Railway proxy.
      // trustProxy=1 means the fix is deployed; clientIp tells us whether req.ip
      // is the real client (public) or still the proxy's private IP.
      network: {
        trustProxy: req.app.get('trust proxy'),
        clientIp: req.ip,
        ips: req.ips,
        forwardedFor: req.headers['x-forwarded-for'] ?? null
      },
      server: {
        environment: process.env.NODE_ENV,
        hostname: os.hostname(),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        cpus: os.cpus().length,
        memoryTotal: os.totalmem(),
        memoryFree: os.freemem()
      },
      database: {
        status: dbStatusMap[dbState] || 'unknown',
        connected: dbState === 1
      }
    };

    res.status(200).json(healthInfo);
  } catch (error) {
    logger.error(`Health check error: ${(error as Error).message}`);
    res.status(500).json({ 
      status: 'error', 
      message: (error as Error).message 
    });
  }
}; 