import mongoose, { Document, Schema } from 'mongoose';

export interface IRevenue extends Document {
  user: mongoose.Types.ObjectId;
  total: number;
  withdrawn: number;
  updatedAt: Date;
}

const RevenueSchema: Schema = new Schema<IRevenue>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  total: { type: Number, default: 0 },
  withdrawn: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IRevenue>('Revenue', RevenueSchema); 