import { Request } from '../interfaces/Request';
import mongoose, { Schema } from 'mongoose';

export const RequestSchema: Schema<Request> = new Schema(
    {
        type: {
            type: String,
            enum: ['course_approval', 'business_verification', 'instructor_verification'],
            required: true
        },
        courseId: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed', 'deleted'], default: 'pending' },
        message: { type: String, default: '' },
        processedAt: { type: Date, default: null },
        deletedAt: { type: Date, default: null },
        data: {
            type: Schema.Types.Mixed,
            required: false
        }
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

export default mongoose.models.Request || mongoose.model<Request>('Request', RequestSchema);
