import { Types } from 'mongoose';

export interface Certificate {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  course: Types.ObjectId;
  userName: string;
  courseName: string;
  completedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
