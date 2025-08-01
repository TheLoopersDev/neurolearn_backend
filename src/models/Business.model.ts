import mongoose, { Schema } from 'mongoose';
import { BusinessT } from '../interfaces/Business';

const BusinessSchema: Schema<BusinessT> = new Schema(
    {
        businessName: {
            type: String,
            required: [true, 'Please provide business name'],
            trim: true
        },
        description: { type: String, trim: true },
        taxCode: { type: String, trim: true },
        email: { type: String, trim: true },
        address: { type: String, trim: true },
        businessSector: { type: String, trim: true },
        logo: { type: String, trim: true },
        docImages: { type: [String], default: [] },
        representative: {
            name: { type: String, trim: true },
            phone: { type: String, trim: true },
            email: { type: String, trim: true },
            address: { type: String, trim: true }
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        employees: {
            type: [
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
                    },
                    createdAt: { type: Date, default: Date.now }
                }
            ],
            default: []
        },
        courses: {
            type: [
                {
                    course: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'Course',
                        required: true
                    },
                    totalLicenses: { type: Number, required: true, default: 0 }
                }
            ],
            default: []
        },
        discounts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Discount'
            }
        ],

        isVerified: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret: any) {
                delete ret?.__v;
                return ret;
            }
        },
        toObject: {
            transform(doc: any, ret: any) {
                delete ret?.__v;
                return ret;
            }
        }
    }
);

export default mongoose.models.Business || mongoose.model<BusinessT>('Business', BusinessSchema);
