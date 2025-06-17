import mongoose, { Schema } from 'mongoose';
import { BusinessT } from '../interfaces/Business';

const BusinessSchema: Schema<BusinessT> = new Schema(
    {
        businessName: {
            type: String,
            required: [true, 'Please provide business name'],
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        employees: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },
                role: {
                    type: String,
                    enum: ['admin', 'manager', 'employee'],
                    required: true
                }
            }
        ],
        courses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course'
            }
        ],
        isVerified: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                return ret;
            }
        },
        toObject: {
            transform(doc: any, ret: any) {
                delete ret.__v;
                return ret;
            }
        }
    }
);

export default mongoose.models.Business || mongoose.model<BusinessT>('Business', BusinessSchema);
