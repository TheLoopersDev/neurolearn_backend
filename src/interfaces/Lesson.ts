import { Document, Types } from 'mongoose';
import { UserT } from './User';

export interface ILink extends Document {
    title: string;
    url: string;
}

export interface IComment extends Document {
    user: UserT;
    question: string;
    questionReplies: IComment[];
}

export interface ILesson extends Document {
    sectionId: Types.ObjectId;
    order: number;
    title: string;
    description?: string;
    videoUrl?: {
        public_id: string;
        url: string;
    };
    videoLength?: number;
    videoPlayer?: string;
    links?: ILink[];
    suggestion?: string;
    questions?: IComment[];
    isCompleted?: boolean;
    isPublished?: boolean;
    isFree?: boolean;
}
