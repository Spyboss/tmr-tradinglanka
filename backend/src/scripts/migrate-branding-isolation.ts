import mongoose from 'mongoose';
import Branding from '../models/Branding';
import dotenv from 'dotenv';

dotenv.config();

const migrateBranding = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tmr';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find the existing singleton branding document (the one without userId)
    const existingBranding = await Branding.findOne({ userId: { $exists: false } });

    if (existingBranding) {
      console.log('Found existing branding document. Migrating to system default...');
      existingBranding.userId = null as any;
      await existingBranding.save();
      console.log('Migration successful: Existing branding is now system default.');
    } else {
      // Check if system default already exists
      const systemDefault = await Branding.findOne({ userId: null });
      if (systemDefault) {
        console.log('System default branding already exists. No migration needed.');
      } else {
        console.log('No branding document found. Creating system default...');
        await Branding.create({
          userId: null,
          dealerName: 'TMR Trading Lanka (Pvt) Ltd',
          primaryColor: '#d32f2f',
          addressLine1: 'Embilipitiya'
        });
        console.log('Created system default branding.');
      }
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateBranding();
