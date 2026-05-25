import mongoose, { Document, Schema } from 'mongoose';

// Define interface for quotation item
export interface IQuotationItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// Define interface for quotation document
export interface IQuotation extends Document {
  // Quotation identification
  quotationNumber: string;
  quotationDate: Date;
  type: 'quotation' | 'invoice'; // For quotation → invoice conversion
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';

  // Customer details (can reference existing bill customers)
  customerName: string;
  customerNIC?: string;
  customerAddress: string;
  customerPhone?: string;
  bikeRegNo?: string;

  // Reference to existing bill customer (optional)
  referenceBillId?: mongoose.Types.ObjectId;

  // Items
  items: IQuotationItem[];
  totalAmount: number;

  // Additional details
  remarks: string;
  validUntil?: Date;

  // Insurance/accident specific fields
  accidentDate?: Date;
  claimNumber?: string;
  insuranceCompany?: string;

  // Owner reference (for authorization)
  owner: mongoose.Types.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema = new Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  }
});

const QuotationSchema = new Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  quotationDate: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['quotation', 'invoice'],
    default: 'quotation'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'converted'],
    default: 'draft'
  },

  // Customer details
  customerName: {
    type: String,
    required: true
  },
  customerNIC: {
    type: String,
    encrypted: true // This field will be encrypted like in Bill model
  },
  customerAddress: {
    type: String,
    required: true,
    encrypted: true // This field will be encrypted like in Bill model
  },
  customerPhone: {
    type: String,
    encrypted: true // This field will be encrypted
  },
  bikeRegNo: {
    type: String
  },

  // Reference to existing bill customer (optional)
  referenceBillId: {
    type: Schema.Types.ObjectId,
    ref: 'Bill'
  },

  // Items
  items: [QuotationItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Additional details
  remarks: {
    type: String,
    default: ''
  },
  validUntil: {
    type: Date
  },

  // Insurance/accident specific fields
  accidentDate: {
    type: Date
  },
  claimNumber: {
    type: String
  },
  insuranceCompany: {
    type: String
  },

  // Owner reference (for authorization)
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate quotation number BEFORE validation
QuotationSchema.pre('validate', function(this: any, next) {
  if (this.isNew && !this.quotationNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 900) + 100;

    // Different prefixes for quotations vs invoices
    const prefix = this.type === 'invoice' ? 'INV' : 'QUO';
    this.quotationNumber = `GM-${prefix}-${year}${month}${day}-${random}`;
  }
  next();
});

// Calculate total amount before saving
QuotationSchema.pre('save', function(this: any, next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((total: number, item: IQuotationItem) => {
      item.amount = item.quantity * item.rate;
      return total + item.amount;
    }, 0);
  }
  next();
});

// Index for better performance (quotationNumber already has unique index)
QuotationSchema.index({ owner: 1 });
QuotationSchema.index({ customerName: 1 });
QuotationSchema.index({ quotationDate: -1 });

const Quotation = mongoose.model<IQuotation>('Quotation', QuotationSchema);

export default Quotation;
