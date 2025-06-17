import { Document, Types } from 'mongoose';

export interface BusinessT extends Document {
    _id: string;

    businessName: string;
    description?: string;

    createdBy: Types.ObjectId;

    employees: {
        user: Types.ObjectId; 
        position: 'admin' | 'manager' | 'employee';
    }[];

    courses: Types.ObjectId[];

    isVerified: boolean;

    signAccessToken: () => string;
    signRefreshToken: () => string;
    comparePassword: (enteredPassword: string) => Promise<boolean>;
}