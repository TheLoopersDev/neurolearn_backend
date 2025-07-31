import { Request } from '../interfaces/Request';
import mongoose, { Schema } from 'mongoose';

export const RequestSchema: Schema<Request> = new Schema(
    {
        type: {
            type: String,
            enum: ['course_approval', 'business_verification', 'instructor_verification'],
            required: true
        },
        courseId: { type: Schema.Types.String, ref: 'Course', default: null },
        userId: { type: Schema.Types.String, ref: 'User', required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
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
