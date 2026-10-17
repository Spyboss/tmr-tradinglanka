/**
 * Script to list all users in the database
 * Run with: npx tsx src/scripts/listUsers.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listUsers() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tmr';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({}).select('-password -refreshTokenHash');
    
    if (users.length === 0) {
      console.log('No users found in the database');
    } else {
      console.log(`Found ${users.length} users:`);
      users.forEach((user, index) => {
        console.log(`\n--- User ${index + 1} ---`);
        console.log(`ID: ${user._id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name || 'N/A'}`);
        console.log(`Role: ${user.role}`);
        console.log(`Last Login: ${user.lastLogin || 'Never'}`);
        console.log(`Account Locked: ${user.accountLocked ? 'Yes' : 'No'}`);
        console.log(`Login Attempts: ${user.loginAttempts || 0}`);
        console.log(`Created At: ${user.createdAt}`);
      });
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
}

// Run the function
listUsers();