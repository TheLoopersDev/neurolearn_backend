import express from 'express';
import { createChat, sendMessage, getUserChats, getChatById, getUserInfoForChat, getAllUsersForChat, getRelatedUsersForChat } from '../controllers/chat.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat APIs
 */

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Tạo chat mới (cá nhân hoặc nhóm)
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách userId
 *               isGroup:
 *                 type: boolean
 *               groupName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo chat thành công
 */
router.post('/', createChat);

/**
 * @swagger
 * /api/chats/users:
 *   get:
 *     summary: Lấy danh sách tất cả user để tạo chat
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Danh sách user (id, name, avatar, email, role)
 */
router.get('/users', getAllUsersForChat);

/**
 * @swagger
 * /api/chats/user/{userId}:
 *   get:
 *     summary: Lấy danh sách chat của user
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Danh sách chat
 */
router.get('/user/:userId', getUserChats);

/**
 * @swagger
 * /api/chats/user-info/{userId}:
 *   get:
 *     summary: Lấy thông tin user phục vụ chat
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Thông tin user (id, name, avatar, email)
 *       404:
 *         description: User not found
 */
router.get('/user-info/:userId', getUserInfoForChat);

/**
 * @swagger
 * /api/chats/related-users:
 *   get:
 *     summary: Lấy danh sách user liên quan đến các phòng chat của user hiện tại
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: ID của user (nếu không dùng session)
 *     responses:
 *       200:
 *         description: Danh sách user liên quan
 */
router.get('/related-users', getRelatedUsersForChat);

/**
 * @swagger
 * /api/chats/{chatId}/message:
 *   post:
 *     summary: Gửi tin nhắn vào chat
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sender:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi tin nhắn thành công
 */
router.post('/:chatId/message', sendMessage);

/**
 * @swagger
 * /api/chats/{chatId}:
 *   get:
 *     summary: Lấy chi tiết chat
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của chat
 *     responses:
 *       200:
 *         description: Chi tiết chat
 */
router.get('/:chatId', getChatById);

export default router; 