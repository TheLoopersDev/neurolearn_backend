import { RequestT } from '@/interfaces/Request';
import mongoose, { Schema } from 'mongoose';

export const RequestSchema: Schema<RequestT> = new Schema(
    {
        type: {
            type: String,
            enum: ['course_approval', 'instructor_registration', 'business_verification'],
            required: true
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            default: null
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_, ret) => {
                delete ret.__v;
                return ret;
            }
        },
        toObject: {
            transform: (_, ret) => {
                delete ret.__v;
                return ret;
            }
        }
    }
);

export default mongoose.models.Request || mongoose.model<RequestT>('Request', RequestSchema);
