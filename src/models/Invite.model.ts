import mongoose, { Document, Schema } from 'mongoose';

export interface IInvite extends Document {
    email: string;
    businessId: mongoose.Types.ObjectId;
    role: 'admin' | 'manager' | 'employee';
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    token: string;
    acceptedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        businessId: {
            type: Schema.Types.ObjectId,
            ref: 'Business',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'manager', 'employee'],
            default: 'employee'
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'expired', 'revoked'],
            default: 'pending'
        },
        token: {
            type: String,
            required: true
        },
        acceptedAt: {
            type: Date
        }
    },
    { timestamps: true }
);

inviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export default mongoose.model<IInvite>('Invite', inviteSchema);
