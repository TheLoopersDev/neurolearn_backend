import mongoose, { Schema } from 'mongoose';
import { IComment, ILink } from '../interfaces/Lesson';

const LinkSchema = new Schema<ILink>({
    title: String,
    url: String
});

const CommentSchema = new Schema<IComment>({
    user: Object,
    question: String,
    questionReplies: [Object]
});

const LessonSchema = new Schema(
    {
        sectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Section',
            required: true
        },
        order: Number,
        title: String,
        description: String,
        videoUrl: {
            public_id: String,
            url: String
        },
        videoPlayer: String,
        videoLength: Number,
        links: [LinkSchema],
        suggestion: String,
        questions: [CommentSchema],
        isCompleted: { type: Boolean, default: false },
        isPublished: { type: Boolean, default: false },
        isFree: { type: Boolean, default: false }
    },
    { timestamps: true }
);

export default mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);
