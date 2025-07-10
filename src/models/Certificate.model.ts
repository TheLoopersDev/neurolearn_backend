import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificate extends Document {
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  userName: string;
  courseName: string;
  completedAt: Date;
  issuedBy?: string;
}

const CertificateSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    userName: { type: String, required: true },
    courseName: { type: String, required: true },
    completedAt: { type: Date, required: true },
    issuedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

CertificateSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.model<ICertificate>('Certificate', CertificateSchema);