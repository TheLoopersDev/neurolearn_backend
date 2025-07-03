import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage {
  sender: Types.ObjectId;
  content: string;
  timestamp: Date;
}

export interface IChat extends Document {
  members: Types.ObjectId[];
  isGroup: boolean;
  groupName?: string;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatSchema = new Schema<IChat>({
  members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  groupName: { type: String },
  messages: [MessageSchema],
});

export default mongoose.model<IChat>('Chat', ChatSchema); 