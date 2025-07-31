import express from 'express';
import * as withdrawController from '../controllers/withdraw.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Withdraw
 *   description: Quản lý yêu cầu rút tiền
 */

/**
 * @swagger
 * /api/withdraw:
 *   post:
 *     summary: Tạo yêu cầu rút tiền
 *     tags: [Withdraw]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankName
 *               - bankAccountNumber
 *               - bankAccountName
 *               - amount
 *             properties:
 *               bankName:
 *                 type: string
 *               bankAccountNumber:
 *                 type: string
 *               bankAccountName:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *                 description: Lý do rút tiền (không bắt buộc, nếu không nhập sẽ lưu là transaction)
 *     responses:
 *       201:
 *         description: Yêu cầu rút tiền đã được tạo
 *       401:
 *         description: Chưa xác thực
 */
router.post('/', isAuthenticated, withdrawController.createWithdraw);

/**
 * @swagger
 * /api/withdraw:
 *   get:
 *     summary: Lấy danh sách yêu cầu rút tiền
 *     tags: [Withdraw]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu rút tiền
 *       401:
 *         description: Chưa xác thực
 */
router.get('/', isAuthenticated, withdrawController.getWithdraws);

/**
 * @swagger
 * /api/withdraw/my-requests:
 *   get:
 *     summary: Lấy danh sách yêu cầu rút tiền của instructor (chỉ instructor)
 *     tags: [Withdraw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item trên mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu rút tiền của instructor
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Chỉ instructor mới được truy cập
 */
router.get('/my-requests', isAuthenticated, authorizeRoles('instructor'), withdrawController.getMyWithdrawRequests);

/**
 * @swagger
 * /api/withdraw/{id}:
 *   get:
 *     summary: Lấy chi tiết yêu cầu rút tiền
 *     tags: [Withdraw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của yêu cầu rút tiền
 *     responses:
 *       200:
 *         description: Chi tiết yêu cầu rút tiền
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy
 */
router.get('/:id', isAuthenticated, withdrawController.getWithdrawById);

/**
 * @swagger
 * /api/withdraw/{id}/status:
 *   patch:
 *     summary: Duyệt hoặc từ chối yêu cầu rút tiền (admin)
 *     tags: [Withdraw]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của yêu cầu rút tiền
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               adminNote:
 *                 type: string
 *               reason:
 *                 type: string
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.patch('/:id/status', isAuthenticated, authorizeRoles('admin'), withdrawController.updateWithdrawStatus);

export default router; 