import mongoose, { Schema } from 'mongoose';
import { ICourse, IReview, IReviewReply } from '../interfaces/Course';

const ReviewReplySchema = new Schema<IReviewReply>(
    {
        user: Object,
        comment: String
    },
    { timestamps: true }
);

const ReviewSchema = new Schema<IReview>(
    {
        user: Object,
        rating: { type: Number, default: 0 },
        comment: String,
        commentReplies: [ReviewReplySchema]
    },
    { timestamps: true }
);

const CourseSchema = new Schema<ICourse>(
    {
        name: { type: String, required: true },
        subTitle: String,
        description: String,
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        price: Number,
        estimatedPrice: Number,
        thumbnail: {
            public_id: String,
            url: String
        },
        tags: String,
        level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level' },
        demoUrl: {
            public_id: String,
            url: String
        },
        benefits: [{ title: String }],
        prerequisites: [{ title: String }],
        reviews: [ReviewSchema],
        sections: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Section'
            }
        ],
        rating: { type: Number, default: 0 },
        purchased: { type: Number, default: 0 },
        isPublished: { type: Boolean, default: false },
        isFree: { type: Boolean, default: false },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
        overview: {
            type: String,
            default: ''
        },
        topics: {
            type: [String], // mảng chuỗi
            default: []
        },
        duration: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

export default mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
