import { webcrypto as crypto } from 'node:crypto';
// Ensure global WebCrypto is available using Node's built-in implementation
if (typeof globalThis.crypto === 'undefined') {
  // Assign Node.js WebCrypto when not present
  // Cast to satisfy TypeScript in Node environment without changing runtime behavior
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = crypto;
}

// Try to import the crypto polyfill for additional functionality
import('./utils/jose-crypto.js').catch(error => {
  console.log('Could not import jose-crypto.js, using minimal polyfill:', error.message);
});

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from './models/User.js';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Validate critical environment variables (fail-fast in production, warn in dev)
const validateStartupEnv = (): void => {
  const isProd = process.env.NODE_ENV === 'production';

  const issues: string[] = [];
  const warnings: string[] = [];

  // NODE_ENV must be set
  if (!process.env.NODE_ENV) {
    const msg = 'NODE_ENV is not set. Set to "development" or "production".';
    (isProd ? issues : warnings).push(msg);
  }

  // ENCRYPTION_KEY must be at least 32 chars
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    const msg = 'ENCRYPTION_KEY is required and must be at least 32 characters. See .env.example.';
    (isProd ? issues : warnings).push(msg);
  }

  // JWT_SECRET must be at least 32 chars
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const msg = 'JWT_SECRET is required and must be at least 32 characters. See .env.example.';
    (isProd ? issues : warnings).push(msg);
  }

  // MONGODB_URI must be set
  if (!process.env.MONGODB_URI) {
    const msg = 'MONGODB_URI is required. Configure a valid MongoDB connection string.';
    (isProd ? issues : warnings).push(msg);
  }

  // REDIS_URL required in production (dev may use mock)
  if (!process.env.REDIS_URL) {
    const msg = 'REDIS_URL is required in production for token revocation and rate limiting.';
    (isProd ? issues : warnings).push(msg);
  }

  if (warnings.length && !isProd) {
    console.warn('[Startup warnings]');
    warnings.forEach(w => console.warn(`- ${w}`));
  }

  if (issues.length) {
    console.error('[Startup errors]');
    issues.forEach(e => console.error(`- ${e}`));
    console.error('Set missing/invalid environment variables. See backend/.env.example and README.');
    process.exit(1);
  }
};

// Run validation early
validateStartupEnv();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import { connectToMongoose, closeDatabaseConnection } from './config/database.js';
import { getRedisClient, closeRedisConnection } from './config/redis.js';
import logger from './utils/logger.js';
import billRoutes from './routes/billRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import bikeModelsRoutes from './routes/bike-models.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import authRoutes from './auth/auth.routes.js';
import gdprRoutes from './routes/gdprRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import brandingRoutes from './routes/brandingRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { apiRateLimit } from './auth/rate-limit.middleware.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { applySecurityMiddleware } from './middleware/security-middleware.js';
import { activityLogger } from './middleware/activityLogger.middleware.js';
import Bill from './models/Bill.js';
import Quotation from './models/Quotation.js';
import UserPreferences from './models/UserPreferences.js';
import UserActivity from './models/UserActivity.js';

// Initialize express
const app = express();
const port = process.env.PORT || 8080;

// CORS Configuration
// Default hard-coded origins kept as safe fallback
const defaultAllowedOrigins = [
  'https://tmr-production.up.railway.app',
  'https://tmr-tradinglanka.pages.dev',
  'http://localhost:5173' // For local development
];

// Allow overriding via env variable CORS_ORIGINS (comma-separated)
const envCorsOrigins = process.env.CORS_ORIGINS;
const allowedOrigins = envCorsOrigins
  ? envCorsOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : defaultAllowedOrigins;

// Log CORS settings for debugging
logger.info(`CORS Origins set to: ${allowedOrigins.join(', ')}`);

// Expose allowed origins to the app for reuse (e.g., CSRF checks in controllers)
app.locals.allowedOrigins = allowedOrigins;

// Apply middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  xssFilter: true,
  hsts: {
    maxAge: 63072000, // 2 years in seconds
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
})); // Security headers

// Apply security middleware
applySecurityMiddleware(app);

// Standard CORS middleware configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowNoOrigin = (process.env.ALLOW_NO_ORIGIN ?? 'true').toLowerCase() !== 'false';

    // Resolve allowed origins dynamically from app.locals to support tests/runtime overrides
    const dynamicAllowed = Array.isArray((this as any)?.locals?.allowedOrigins)
      ? (this as any).locals.allowedOrigins
      : allowedOrigins;

    // Handle requests with no Origin header (CLI/internal tools)
    if (!origin) {
      if (!allowNoOrigin) {
        const msg = 'Not allowed by CORS (no Origin header)';
        logger.warn(msg);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    }

    // Validate provided Origin against allowlist
    if (dynamicAllowed.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      logger.warn(msg);
      return callback(null, false);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middlewares
// Note: The cors() middleware handles OPTIONS preflight requests automatically.
app.use(mongoSanitize()); // Sanitize inputs against NoSQL Injection
app.use(express.json({ limit: '100kb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '100kb' })); // Parse URL-encoded bodies with size limit
app.use(cookieParser()); // Parse cookies for JWT refresh tokens
app.use(morgan('dev', {
  skip: () => process.env.NODE_ENV === 'test',
  stream: { write: (message: string) => logger.http(message.trim()) }
}));

// Apply global rate limiting to all routes
app.use(apiRateLimit);

// Apply activity logging middleware (skip in test to avoid DB writes)
if (process.env.NODE_ENV !== 'test') {
  app.use(activityLogger);
}

// Make models available to middleware
app.use((req, res, next) => {
  req.app.locals.models = {
    User,
    Bill,
    Quotation,
    UserPreferences,
    UserActivity
  };
  next();
});

// Routes
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'TMR Trading Lanka (Pvt) Ltd API is running',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/user',
      '/api/bills',
      '/api/bike-models',
      '/api/inventory',
      '/api/quotations',
      '/api/gdpr'
    ]
  });
});
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/bike-models', bikeModelsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/gdpr', gdprRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Export the app for testing
export default app;

// Check if we're running in admin creation mode
const args = process.argv.slice(2);
if (args.includes('--create-admin')) {
  // Don't start the server normally, just create the admin
  (async () => {
    try {
      // Extract admin details from command line args
      const emailArg = args.find(arg => arg.startsWith('--email='));
      const passwordArg = args.find(arg => arg.startsWith('--password='));
      const nameArg = args.find(arg => arg.startsWith('--name='));

      if (!emailArg || !passwordArg) {
        console.error('Error: Admin creation requires --email=email@example.com and --password=yourpassword');
        process.exit(1);
      }

      const email = emailArg.split('=')[1];
      const password = passwordArg.split('=')[1];
      const name = nameArg ? nameArg.split('=')[1] : 'System Administrator';

      // Connect to database explicitly
      logger.info('Connecting to MongoDB for admin creation...');
      await connectToMongoose();
      logger.info('Connected to MongoDB');

      // Check if admin user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        logger.info(`Admin user with email ${email} already exists`);
        await closeDatabaseConnection();
        process.exit(0);
      }

      // Create admin user
      const user = await User.create({
        email,
        password,
        name,
        role: 'admin'
      });

      logger.info(`Admin user created successfully: ${email} (ID: ${user._id})`);

      // Close database connection
      await closeDatabaseConnection();
      process.exit(0);
    } catch (error) {
      logger.error(`Error creating admin user: ${error}`);
      process.exit(1);
    }
  })();
} else if (process.env.VITEST_WORKER_ID || process.env.NODE_ENV === 'test') {
  
} else {
  const server = app.listen(port, async () => {
    try {
      // Connect to database
      await connectToMongoose();

      // Initialize Redis
      getRedisClient();

      // One-time admin seed guard
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword) {
          const existingAdmin = await User.findOne({ email: adminEmail, role: 'admin' });
          if (!existingAdmin) {
            await User.create({ email: adminEmail, password: adminPassword, name: 'Administrator', role: 'admin' });
            logger.info(`Seeded initial admin: ${adminEmail}`);
          }
        }
      } catch (seedErr) {
        logger.warn(`Admin seed guard failed: ${String(seedErr)}`);
      }

      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
    } catch (error) {
      logger.error(`Server startup error: ${error}`);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(async () => {
      logger.info('HTTP server closed');
      await closeDatabaseConnection();
      await closeRedisConnection();
      process.exit(0);
    });
  });
}
