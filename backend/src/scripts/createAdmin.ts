/**
 * Script to create an admin user directly in the database
 * Run with: npx tsx src/scripts/createAdmin.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User, { UserRole } from '../models/User.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Admin user details from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Admin';

// Validate required environment variables
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  console.error('Please set these in your .env file.');
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 8) {
  console.error('Error: ADMIN_PASSWORD must be at least 8 characters long');
  process.exit(1);
}

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tmr';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log(`Admin user with email ${ADMIN_EMAIL} already exists`);
      await mongoose.disconnect();
      return;
    }

    // Create admin user
    const admin = new User({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: UserRole.ADMIN
    });

    await admin.save();
    console.log(`Admin user created successfully: ${ADMIN_EMAIL}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();