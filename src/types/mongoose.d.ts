import mongoose from 'mongoose';

declare module 'mongoose' {
    interface Model<T> {
        findById(id: string | mongoose.Types.ObjectId): Promise<T | null>;
        findOne(filter: any): Promise<T | null>;
        find(filter?: any): Promise<T[]>;
        findByIdAndUpdate(id: string | mongoose.Types.ObjectId, update: any, options?: any): Promise<T | null>;
        findByIdAndDelete(id: string | mongoose.Types.ObjectId): Promise<T | null>;
        findOneAndUpdate(filter: any, update: any, options?: any): Promise<T | null>;
        findOneAndDelete(filter: any): Promise<T | null>;
        countDocuments(filter?: any): Promise<number>;
        create(data: any): Promise<T>;
    }
}
