import { Types } from 'mongoose';

export interface IMessage {
  sender: Types.ObjectId;
  content: string;
  timestamp: Date;
}

export interface IChat {
  _id?: Types.ObjectId;
  members: Types.ObjectId[];
  isGroup: boolean;
  groupName?: string;
  messages: IMessage[];
} 