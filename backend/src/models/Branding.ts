import mongoose, { Schema, Document } from 'mongoose';

export interface IBranding extends Document {
  userId?: mongoose.Types.ObjectId; // Optional for system-wide default
  dealerName: string;
  logoUrl?: string;
  primaryColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  brandPartner?: string;
  footerNote?: string;
  // Tax profile (VAT / IRD Gazette 2481/22)
  tin?: string;
  vatNumber?: string;
  phone?: string;
  pricesIncludeVat: boolean;
  vatRate: number;
  taxInvoiceCode: string;
  commercialInvoiceCode: string;
  updatedAt: Date;
}

const tinValidator = (v?: string): boolean => !v || /^\d{9}$/.test(v);

const BrandingSchema = new Schema<IBranding>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true // Allows multiple documents with null userId (though we'll likely have only one system default)
  },
  dealerName: {
    type: String,
    default: 'TMR Trading Lanka (Pvt) Ltd',
    trim: true,
  },
  logoUrl: { type: String, trim: true },
  primaryColor: { type: String, trim: true, default: '#d32f2f' },
  addressLine1: { type: String, trim: true },
  addressLine2: { type: String, trim: true },
  brandPartner: { type: String, trim: true },
  footerNote: { type: String, trim: true },
  tin: {
    type: String,
    trim: true,
    validate: { validator: tinValidator, message: 'TIN must be exactly 9 digits' },
  },
  vatNumber: { type: String, trim: true },
  phone: { type: String, trim: true },
  pricesIncludeVat: { type: Boolean, default: true },
  vatRate: { type: Number, default: 18, min: 0, max: 100 },
  taxInvoiceCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'TX01',
    validate: { validator: (v: string) => /^[A-Z0-9]{1,15}$/.test(v), message: 'Tax invoice code must be 1-15 alphanumeric characters' },
  },
  commercialInvoiceCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'CM01',
    validate: { validator: (v: string) => /^[A-Z0-9]{1,15}$/.test(v), message: 'Commercial invoice code must be 1-15 alphanumeric characters' },
  },
}, { timestamps: true });

// Single-document collection pattern: we will always operate on the first document
const Branding = mongoose.model<IBranding>('Branding', BrandingSchema);
export default Branding;