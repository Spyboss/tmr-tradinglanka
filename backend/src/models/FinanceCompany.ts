import mongoose, { Schema, Document } from 'mongoose';

export interface IFinanceCompany extends Document {
  name: string;
  address: string;
  contact: string;
  updatedAt: Date;
}

const FinanceCompanySchema = new Schema<IFinanceCompany>({
  name: { type: String, required: true, trim: true, unique: true },
  address: { type: String, required: true, trim: true },
  contact: { type: String, required: true, trim: true },
}, { timestamps: true });

const FinanceCompany = mongoose.model<IFinanceCompany>('FinanceCompany', FinanceCompanySchema);
export default FinanceCompany;
