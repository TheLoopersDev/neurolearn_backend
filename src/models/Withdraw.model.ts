import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdraw extends Document {
  user: mongoose.Types.ObjectId;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  adminNote?: string;
  reason?: string;
  transactionId?: string;
}

const WithdrawSchema: Schema = new Schema<IWithdraw>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bankName: { type: String, required: true },
  bankAccountNumber: { type: String, required: true },
  bankAccountName: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  adminNote: { type: String },
  reason: { type: String },
  transactionId: { type: String },
});

export default mongoose.model<IWithdraw>('Withdraw', WithdrawSchema); 