import { Request, Response } from 'express';
import * as chatService from '../services/chat.service';
import { Types } from 'mongoose';
import { getUserInfoForChat as getUserInfoForChatService, getAllUsersForChat as getAllUsersForChatService } from '../services/user.service';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';

export const createChat = catchAsync(async (req: Request, res: Response) => {
  const { members, isGroup, groupName } = req.body;
  const chat = await chatService.createChat(members, isGroup, groupName);
  res.status(201).json(chat);
});

export const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { sender, content } = req.body;
  
  if (!Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: 'Invalid chat ID format' });
  }
  
  const chat = await chatService.sendMessage(new Types.ObjectId(chatId), sender, content);
  res.status(200).json(chat);
});

export const getUserChats = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }
  
  const chats = await chatService.getUserChats(new Types.ObjectId(userId));
  res.status(200).json(chats);
});

export const getChatById = catchAsync(async (req: Request, res: Response) => {
  const { chatId } = req.params;
  
  if (!Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: 'Invalid chat ID format' });
  }
  
  const chat = await chatService.getChatById(new Types.ObjectId(chatId));
  res.status(200).json(chat);
});

export const getUserInfoForChat = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }
  
  const user = await getUserInfoForChatService(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.status(200).json(user);
});

export const getAllUsersForChat = catchAsync(async (req: Request, res: Response) => {
  try {
    const users = await getAllUsersForChatService();
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error in getAllUsersForChat:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});

export const getRelatedUsersForChat = catchAsync(async (req: Request, res: Response) => {
  // Lấy userId từ query hoặc từ req.user nếu có middleware auth
  const userId = req.query.userId as string || (req as any).user?._id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, message: 'Missing or invalid userId' });
  }

  // Lấy tất cả chat room mà user này tham gia
  const chats = await chatService.getUserChats(new Types.ObjectId(userId));
  // Lấy tất cả userId xuất hiện trong các trường members
  const userIdSet = new Set<string>();
  chats.forEach((chat: any) => {
    chat.members.forEach((member: any) => {
      userIdSet.add(member._id.toString());
    });
  });
  // Xóa userId hiện tại khỏi danh sách nếu muốn (nếu FE không cần chính mình)
  // userIdSet.delete(userId);
  // Truy vấn bảng user để lấy thông tin chi tiết
  const users = await getAllUsersForChatService();
  const relatedUsers = users.filter((user: any) => userIdSet.has(user._id.toString()));
  res.status(200).json({
    success: true,
    users: relatedUsers
  });
}); 