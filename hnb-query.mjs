import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

const getSecretKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY env var required');
  return key;
};

const decrypt = (encryptedValue) => {
  if (!encryptedValue) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, getSecretKey());
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch { return encryptedValue; }
};

const encryptionPlugin = (schema) => {
  const encryptedFields = [];
  schema.eachPath((pathname, schemaType) => {
    if (schemaType.options && schemaType.options.encrypted) encryptedFields.push(pathname);
  });
  if (encryptedFields.length === 0) return;
  schema.post('find', function(docs) {
    if (!Array.isArray(docs)) return;
    docs.forEach((doc) => {
      encryptedFields.forEach((field) => {
        const value = doc.get(field);
        if (value) {
          try { const d = decrypt(value); if (d) doc.set(field, d, { skipEncryption: true }); } catch {}
        }
      });
    });
  });
  schema.post('findOne', function(doc) {
    if (!doc) return;
    encryptedFields.forEach((field) => {
      const value = doc.get(field);
      if (value) {
        try { const d = decrypt(value); if (d) doc.set(field, d, { skipEncryption: true }); } catch {}
      }
    });
  });
};

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  bill_number: { type: String, unique: true, sparse: true },
  billDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed', 'cancelled', 'converted'], default: 'pending' },
  customerName: { type: String, required: true },
  customerNIC: { type: String, required: true, encrypted: true },
  customerAddress: { type: String, required: true, encrypted: true },
  customerPhone: { type: String, encrypted: true, trim: true },
  bikeModel: { type: String, required: true },
  motorNumber: { type: String, required: true },
  chassisNumber: { type: String, required: true },
  bikePrice: { type: Number, required: true },
  vehicleType: { type: String, enum: ['E-MOTORCYCLE', 'E-MOTORBICYCLE', 'E-TRICYCLE'], default: 'E-MOTORCYCLE' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BikeInventory' },
  originalAdvanceBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
  finalBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
  billType: { type: String, enum: ['cash', 'leasing'], required: true, default: 'cash' },
  isEbicycle: { type: Boolean, default: false },
  isTricycle: { type: Boolean, default: false },
  rmvCharge: { type: Number, default: 13000 },
  downPayment: { type: Number },
  isAdvancePayment: { type: Boolean, default: false },
  advanceAmount: { type: Number },
  balanceAmount: { type: Number },
  estimatedDeliveryDate: { type: Date },
  isFirstTricycleSale: { type: Boolean, default: false },
  totalAmount: { type: Number, required: true },
  proforma: {
    type: {
      type: String, enum: ['leasing', 'finance', 'insurance'], default: 'leasing'
    },
    documentNumber: { type: String, trim: true },
    issueDate: { type: Date },
    financeCompanyName: { type: String, trim: true },
    financeCompanyAddress: { type: String, trim: true },
    financeCompanyContact: { type: String, trim: true },
    customerContact: { type: String, trim: true },
    manufactureYear: { type: String, trim: true },
    color: { type: String, trim: true },
    motorPower: { type: String, trim: true },
    unitPrice: { type: Number },
    downPayment: { type: Number },
    amountToBeLeased: { type: Number },
    updatedAt: { type: Date }
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'bills' });

billSchema.plugin(encryptionPlugin);
const Bill = mongoose.model('Bill', billSchema);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var required');

  await mongoose.connect(uri);
  console.error('Connected to MongoDB (read-only query)\n');

  const fromDate = new Date('2026-01-01T00:00:00.000Z');
  const toDate = new Date('2026-05-24T23:59:59.999Z');

  // HNB Finance variations
  const hnbPattern = /hnb.*finance/i;

  const hnbBills = await Bill.find({
    'proforma.financeCompanyName': { $regex: hnbPattern },
    billDate: { $gte: fromDate, $lte: toDate }
  }).sort({ billDate: 1 });

  const output = {
    queryDate: new Date().toISOString(),
    dateRange: { from: '2026-01-01', to: '2026-05-24' },
    count: hnbBills.length,
    bills: hnbBills.map(b => ({
      billNumber: b.billNumber,
      billDate: b.billDate,
      customerName: b.customerName,
      customerNIC: b.customerNIC || '(encrypted)',
      customerAddress: b.customerAddress || '(encrypted)',
      chassisNumber: b.chassisNumber,
      motorNumber: b.motorNumber,
      bikeModel: b.bikeModel,
      proformaColor: b.proforma?.color || '',
      totalAmount: b.totalAmount,
      downPayment: b.downPayment,
      status: b.status,
      financeCompany: b.proforma?.financeCompanyName,
      proformaDocNumber: b.proforma?.documentNumber || ''
    })),
    uniqueFinanceNames: [...new Set(hnbBills.map(b => b.proforma?.financeCompanyName).filter(Boolean))]
  };

  console.log(JSON.stringify(output, null, 2));
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Query failed:', err);
  process.exit(1);
});
