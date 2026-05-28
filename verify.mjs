import mongoose from 'mongoose';
const s = new mongoose.Schema({}, { strict: false, collection: 'bills' });
const Bill = mongoose.model('Bill', s);
await mongoose.connect(process.env.MONGODB_URI);
const bills = await Bill.find({
  'proforma.financeCompanyName': /hnb.*finance/i,
  billDate: { $gte: new Date('2026-01-01'), $lte: new Date('2026-05-24') }
}).lean();
for (const b of bills) {
  console.log(b.billNumber, '| billType:', b.billType, '| status:', b.status, '| total:', b.totalAmount, '| customer:', b.customerName);
}
await mongoose.disconnect();