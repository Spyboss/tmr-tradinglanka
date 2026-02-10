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
  updatedAt: Date;
}

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
}, { timestamps: true });

// Single-document collection pattern: we will always operate on the first document
const Branding = mongoose.model<IBranding>('Branding', BrandingSchema);
export default Branding;