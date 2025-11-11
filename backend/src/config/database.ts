import { MongoClient, Db } from 'mongodb';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Define the MongoDB URI strictly from environment
const MONGODB_URI = process.env.MONGODB_URI as string;
const DB_NAME = process.env.MONGODB_DB_NAME || 'tmr';

// Connect to MongoDB directly using MongoDB client
export const connectToDatabase = async (): Promise<Db> => {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    if (!MONGODB_URI) {
      const msg = 'MONGODB_URI environment variable is required. Set it in your environment (.env for development).';
      logger.error(msg);
      throw new Error(msg);
    }
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    logger.info('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    logger.error(`MongoDB connection error: ${(error as Error).message}`);
    throw error;
  }
};

// MongoDB connection options for Mongoose
const mongooseOptions: mongoose.ConnectOptions = {
  // Explicitly set database name to avoid Atlas default 'test'
  dbName: DB_NAME,
  // Only build indexes automatically in development
  autoIndex: process.env.NODE_ENV === 'development',
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

/**
 * Connect to MongoDB database using Mongoose
 */
export const connectToMongoose = async (): Promise<typeof mongoose> => {
  try {
    logger.info('Connecting to MongoDB with Mongoose...');
    if (!MONGODB_URI) {
      const msg = 'MONGODB_URI environment variable is required. Set it in your environment (.env for development).';
      logger.error(msg);
      // In production, we might want to exit the process
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      throw new Error(msg);
    }
    await mongoose.connect(MONGODB_URI, mongooseOptions);

    // Log connection events in development
    if (process.env.NODE_ENV !== 'production') {
      mongoose.connection.on('connected', () => {
        logger.info(`MongoDB connected to ${MONGODB_URI}`);
      });

      mongoose.connection.on('error', (err: Error) => {
        logger.error(`MongoDB connection error: ${err.message}`);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      // If the Node process ends, close the Mongoose connection
      process.on('SIGINT', async () => {
        await closeMongooseConnection();
        process.exit(0);
      });
    } else {
      logger.info('MongoDB connected');
    }

    return mongoose;
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${(error as Error).message}`);
    // In production, we might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Close the MongoDB connection for both MongoDB client and Mongoose
 */
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    // Close MongoDB client connection
    if (cachedClient) {
      await cachedClient.close();
      cachedClient = null;
      cachedDb = null;
    }
    
    // Close Mongoose connection
    await closeMongooseConnection();
    
    logger.info('All MongoDB connections closed');
  } catch (error) {
    logger.error(`Error closing MongoDB connections: ${(error as Error).message}`);
  }
};

/**
 * Close only the Mongoose connection
 */
export const closeMongooseConnection = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('Mongoose connection closed');
  } catch (error) {
    logger.error(`Error closing Mongoose connection: ${(error as Error).message}`);
  }
};