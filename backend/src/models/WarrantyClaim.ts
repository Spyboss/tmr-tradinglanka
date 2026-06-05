import mongoose, { Document, Schema } from 'mongoose';

export interface IWarrantyItem {
  item: string;
  partNumber: string;
  description: string;
  remark: string;
}

export interface IWarrantyPart {
  partType: string;
  customLabel?: string;
  serialNumbers: string[];
}

export interface IWarrantyClaim extends Document {
  warrantyNumber: string;
  formNumber: string;
  serialNumber: string;
  warrantyDate: Date;
  status: 'pending' | 'completed' | 'cancelled';

  customerName: string;
  customerPhone: string;
  customerAddress: string;
  chassisNumber: string;
  registerNo: string;
  motorNumber: string;
  bikeModel: string;
  color: string;
  odometerReading: string;
  dateOfSale: Date;
  dateOfComplaint: Date;
  dateOfRepair: Date;

  defectReported: string;
  probableCause: string;
  actionTaken: string;
  suggestion: string;

  items: IWarrantyItem[];

  officeComments: string;
  approvedBy: string;
  approvalDate: Date;

  batterySerialNumbers: string[];
  warrantyParts: IWarrantyPart[];
  qrCodeData: string;

  billId?: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const WarrantyClaimSchema = new Schema<IWarrantyClaim>({
  warrantyNumber: {
    type: String,
    required: true,
    unique: true
  },
  formNumber: {
    type: String,
    default: ''
  },
  serialNumber: {
    type: String,
    default: ''
  },
  warrantyDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },

  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  chassisNumber: { type: String, default: '' },
  registerNo: { type: String, default: '' },
  motorNumber: { type: String, default: '' },
  bikeModel: { type: String, default: '' },
  color: { type: String, default: '' },
  odometerReading: { type: String, default: '' },
  dateOfSale: { type: Date },
  dateOfComplaint: { type: Date },
  dateOfRepair: { type: Date },

  defectReported: { type: String, default: '' },
  probableCause: { type: String, default: '' },
  actionTaken: { type: String, default: '' },
  suggestion: { type: String, default: '' },

  items: [{
    item: { type: String, default: '' },
    partNumber: { type: String, default: '' },
    description: { type: String, default: '' },
    remark: { type: String, default: '' }
  }],

  officeComments: { type: String, default: '' },
  approvedBy: { type: String, default: '' },
  approvalDate: { type: Date },

  batterySerialNumbers: [{ type: String }],
  warrantyParts: [{
    partType: { type: String, required: true },
    customLabel: { type: String, default: '' },
    serialNumbers: [{ type: String }]
  }],
  qrCodeData: { type: String, default: '' },

  billId: {
    type: Schema.Types.ObjectId,
    ref: 'Bill'
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

WarrantyClaimSchema.pre('validate', function(this: IWarrantyClaim, next) {
  if (this.isNew && !this.warrantyNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.warrantyNumber = `WAR-${year}${month}${day}-${random}`;
  }
  next();
});

WarrantyClaimSchema.index({ owner: 1 });
WarrantyClaimSchema.index({ chassisNumber: 1 });
WarrantyClaimSchema.index({ motorNumber: 1 });

export default mongoose.model<IWarrantyClaim>('WarrantyClaim', WarrantyClaimSchema);
