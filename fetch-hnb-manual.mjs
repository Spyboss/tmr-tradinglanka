import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

const key = process.env.ENCRYPTION_KEY;
const decrypt = (v) => { if (!v) return ''; try { return CryptoJS.AES.decrypt(v, key).toString(CryptoJS.enc.Utf8); } catch { return v; } };
const encPlugin = (s) => {
  const f = []; s.eachPath((p, t) => { if (t.options?.encrypted) f.push(p); });
  if (!f.length) return;
  s.post('find', function(docs) { if (Array.isArray(docs)) docs.forEach(d => f.forEach(fi => { const v = d.get(fi); if (v) { try { const dv = decrypt(v); if (dv) d.set(fi, dv, {skipEncryption: true}); } catch {} } })); });
};
const bs = new mongoose.Schema({
  billNumber: String, billDate: Date, status: String, customerName: String,
  customerNIC: { type: String, encrypted: true }, customerAddress: { type: String, encrypted: true },
  chassisNumber: String, motorNumber: String, bikeModel: String, totalAmount: Number,
  downPayment: Number, billType: String, isAdvancePayment: Boolean,
  proforma: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'bills' });
bs.plugin(encPlugin);
const Bill = mongoose.model('Bill', bs);

await mongoose.connect(process.env.MONGODB_URI);
const bills = await Bill.find({
  billNumber: { $in: ['BILL-260311-621', 'BILL-260318-300', 'BILL-260407-794'] }
}).sort({ billDate: 1 });
for (const b of bills) {
  console.log(JSON.stringify({
    billNumber: b.billNumber,
    billDate: b.billDate,
    customerName: b.customerName,
    customerNIC: b.customerNIC,
    customerAddress: b.customerAddress,
    chassisNumber: b.chassisNumber,
    motorNumber: b.motorNumber,
    bikeModel: b.bikeModel,
    totalAmount: b.totalAmount,
    downPayment: b.downPayment,
    billType: b.billType,
    status: b.status,
    proformaColor: b.proforma?.color || '',
    isAdvancePayment: b.isAdvancePayment
  }, null, 2));
}
await mongoose.disconnect();