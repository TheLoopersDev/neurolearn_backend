import mongoose, { Document } from 'mongoose';

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
    name: string;
    examTitle?: string;
    duration: string;
    imageUrl?: string;
    category?: string;
    progress?: number;
    totalQuestions?: number;
    questions: IQuestion[];
    instructorId: mongoose.Schema.Types.ObjectId;
    courseId: mongoose.Schema.Types.ObjectId;
    description?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    passingScore: number;
    maxAttempts: number;
    isPublished: boolean;
    sectionOrder?: number;
    lessonOrder?: number;
    userScores: {
        user: mongoose.Schema.Types.ObjectId;
        score: number;
        attemptedAt?: Date;
    }[];
    createdAt?: Date;
    updatedAt?: Date;
}

