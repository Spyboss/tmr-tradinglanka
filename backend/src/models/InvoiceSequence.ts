import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceSequence extends Document {
  /** Classification code (QQQQ segment), e.g. TX01 */
  code: string;
  /** Period key, e.g. 26OCT */
  period: string;
  /** Last issued sequence number for this (code, period) */
  seq: number;
}

const InvoiceSequenceSchema = new Schema<IInvoiceSequence>({
  code: { type: String, required: true, trim: true },
  period: { type: String, required: true, trim: true },
  seq: { type: Number, required: true, default: 0 },
}, { timestamps: false });

// Atomicity anchor: one document per (classification, month), $inc is race-free.
InvoiceSequenceSchema.index({ code: 1, period: 1 }, { unique: true });

const InvoiceSequence = mongoose.model<IInvoiceSequence>('InvoiceSequence', InvoiceSequenceSchema);
export default InvoiceSequence;
