import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const COMPANIES = [
  { name: 'COMMERCIAL CREDIT & FINANCE PLC', address: 'No.53, Main Street, Hayesha Building, Embilipitiya', contact: '0770550898' },
  { name: 'HNB FINANCE PLC', address: 'No. 59, 2nd floor, Ratnaweera Building, Pallegama, Embilipitiya', contact: '0710293379' },
  { name: 'SARVODAYA DEVELOPMENT FINANCE PLC', address: 'No 220/A, Main Street, Godakawela', contact: '0718977404' },
  { name: "People's Micro-commerce LTD (PML)", address: 'TM Hotel House, Moraketiya Road, Embilipitiya', contact: '047-2018220' },
  { name: 'LB Finance PLC', address: 'No.21 New Town Road, Embilipitiya', contact: '0472 262 766' },
  { name: 'Ceylinco Insurance PLC', address: 'Ceylinco Insurance PLC', contact: '0766476436' },
];

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tmr';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const { default: FinanceCompany } = await import('../models/FinanceCompany.js');

    for (const company of COMPANIES) {
      const existing = await FinanceCompany.findOne({ name: company.name });
      if (existing) {
        existing.address = company.address;
        existing.contact = company.contact;
        await existing.save();
        console.log(`Updated: ${company.name}`);
      } else {
        await FinanceCompany.create(company);
        console.log(`Created: ${company.name}`);
      }
    }

    console.log('\nSeed complete.');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
