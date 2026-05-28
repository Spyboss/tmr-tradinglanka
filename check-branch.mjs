import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

const getSecretKey = () => { const k = process.env.ENCRYPTION_KEY; if (!k || k.length < 32) throw new Error('bad key'); return k; };
const decrypt = (v) => { if (!v) return ''; try { return CryptoJS.AES.decrypt(v, getSecretKey()).toString(CryptoJS.enc.Utf8); } catch { return v; } };

const encryptionPlugin = (schema) => {
  const encryptedFields = [];
  schema.eachPath((p, t) => { if (t.options?.encrypted) encryptedFields.push(p); });
  if (!encryptedFields.length) return;
  schema.post('find', function(docs) {
    if (!Array.isArray(docs)) return;
    docs.forEach(d => { encryptedFields.forEach(f => { const v = d.get(f); if (v) { try { const dv = decrypt(v); if (dv) d.set(f, dv, {skipEncryption: true}); } catch {} } }); });
  });
  schema.post('findOne', function(d) {
    if (!d) return;
    encryptedFields.forEach(f => { const v = d.get(f); if (v) { try { const dv = decrypt(v); if (dv) d.set(f, dv, {skipEncryption: true}); } catch {} } });
  });
};

const billSchema = new mongoose.Schema({
  billNumber: String, billDate: Date, status: String,
  customerName: String, customerNIC: { type: String, encrypted: true }, customerAddress: { type: String, encrypted: true },
  customerPhone: { type: String, encrypted: true }, bikeModel: String, motorNumber: String, chassisNumber: String,
  billType: String, downPayment: Number, totalAmount: Number, isAdvancePayment: Boolean,
  proforma: { type: mongoose.Schema.Types.Mixed },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { collection: 'bills' });
billSchema.plugin(encryptionPlugin);
const Bill = mongoose.model('Bill', billSchema);

const userSchema = new mongoose.Schema({
  username: String, email: String, role: String, name: String, branch: String, isActive: Boolean
}, { collection: 'users' });
const User = mongoose.model('User', userSchema);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.error('Connected\n');

  // Find the HNB customer with NIC 199272203040
  const hnbCustomer = await Bill.findOne({
    customerNIC: '199272203040',
    billDate: { $gte: new Date('2026-01-01'), $lte: new Date('2026-05-24') }
  });
  if (!hnbCustomer) { console.error('Not found by NIC, trying bill number...');
    const byBill = await Bill.findOne({ billNumber: 'BILL-260411-905' });
    if (byBill) {
      console.log(JSON.stringify({
        billNumber: byBill.billNumber,
        customerName: byBill.customerName,
        customerNIC: byBill.customerNIC,
        customerAddress: byBill.customerAddress,
        customerPhone: byBill.customerPhone,
        owner: byBill.owner,
        billDate: byBill.billDate,
        bikeModel: byBill.bikeModel,
        totalAmount: byBill.totalAmount
      }, null, 2));
      // Look up the owner
      if (byBill.owner) {
        const user = await User.findById(byBill.owner);
        console.log(JSON.stringify({ ownerUser: user ? { username: user.username, name: user.name, role: user.role, branch: user.branch, email: user.email } : null }, null, 2));
      }
    }
  } else {
    console.log(JSON.stringify({
      billNumber: hnbCustomer.billNumber,
      customerName: hnbCustomer.customerName,
      customerNIC: hnbCustomer.customerNIC,
      customerAddress: hnbCustomer.customerAddress,
      customerPhone: hnbCustomer.customerPhone,
      owner: hnbCustomer.owner,
      billDate: hnbCustomer.billDate,
      bikeModel: hnbCustomer.bikeModel,
      totalAmount: hnbCustomer.totalAmount
    }, null, 2));
    if (hnbCustomer.owner) {
      const user = await User.findById(hnbCustomer.owner);
      console.log(JSON.stringify({ ownerUser: user ? { username: user.username, name: user.name, role: user.role, branch: user.branch, email: user.email } : null }, null, 2));
    }
  }

  // Also check the duplicate customer (NIC 973592262V)
  console.error('\n--- Checking duplicate customer NIC 973592262V ---');
  const dups = await Bill.find({
    customerNIC: '973592262V',
    billDate: { $gte: new Date('2026-01-01'), $lte: new Date('2026-05-24') }
  }).sort({ billDate: 1 });
  for (const b of dups) {
    console.log(JSON.stringify({
      billNumber: b.billNumber,
      customerName: b.customerName,
      chassisNumber: b.chassisNumber,
      motorNumber: b.motorNumber,
      totalAmount: b.totalAmount,
      downPayment: b.downPayment,
      isAdvancePayment: b.isAdvancePayment,
      billType: b.billType,
      status: b.status,
      bikeModel: b.bikeModel,
      proformaColor: b.proforma?.color || '',
      proformaDoc: b.proforma?.documentNumber || '',
      owner: b.owner
    }, null, 2));
    if (b.owner) {
      const u = await User.findById(b.owner);
      console.log('  owner:', u ? { name: u.name, username: u.username, role: u.role, branch: u.branch } : 'not found');
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });