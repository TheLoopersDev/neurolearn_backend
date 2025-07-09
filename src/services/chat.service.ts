import ChatModel, { IChat, IMessage } from '../models/Chat.model';
import { Types } from 'mongoose';

export const createChat = async (members: Types.ObjectId[], isGroup = false, groupName?: string) => {
  const chat = new ChatModel({ members, isGroup, groupName });
  await chat.save();
  return await ChatModel.findById(chat._id).populate('members', '_id name avatar email role');
};

export const sendMessage = async (chatId: Types.ObjectId, sender: Types.ObjectId, content: string) => {
  const message: IMessage = { sender, content, timestamp: new Date() };
  await ChatModel.findByIdAndUpdate(
    chatId,
    { $push: { messages: message } },
    { new: true }
  );
  return await ChatModel.findById(chatId).populate('members', '_id name avatar email role');
};

export const getUserChats = async (userId: Types.ObjectId) => {
  return await ChatModel.find({ members: userId }).populate('members', '_id name avatar email role');
};

export const getChatById = async (chatId: Types.ObjectId) => {
  return await ChatModel.findById(chatId).populate('members', '_id name avatar email role');
}; 