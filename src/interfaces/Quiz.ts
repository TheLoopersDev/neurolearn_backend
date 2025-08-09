import { Document, Types } from 'mongoose';

export interface IAnswerOption {
    id: string;
    text: string;
}

export interface IQuestion {
    questionNumber: number;
    title: string;
    questionType: 'single-choice' | 'multiple-choice';
    questionImage?: string | null;
    choicesConfig: {
        isMultipleAnswer: boolean;
        isAnswerWithImageEnabled: boolean;
    };
    options: IAnswerOption[];
    correctAnswerIds: string[];
    points: string;
    isRequired: boolean;
}

export interface IQuiz extends Document {
    // Core
    name: string;
    examTitle?: string;
    duration: string;
    imageUrl?: string;
    category?: string;
    progress?: number;
    totalQuestions?: number;

    // Questions
    questions: IQuestion[];

    // Relations
    instructorId: Types.ObjectId;
    courseId: Types.ObjectId;

    // ✅ Giải pháp B: giống Lesson
    sectionId?: Types.ObjectId; // quiz thuộc section nào (có thể gán sau)
    order?: number; // thứ tự trong section (lesson + quiz dùng chung)

    // Meta
    description?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    passingScore?: number;
    maxAttempts?: number;
    isPublished: boolean;

    // ❌ Loại bỏ các field cũ
    // sectionOrder?: number;
    // lessonOrder?: number;

    // Scores
    userScores: {
        user: Types.ObjectId;
        score: number;
        attemptedAt?: Date;
    }[];

    // Timestamps
    createdAt?: Date;
    updatedAt?: Date;
}
