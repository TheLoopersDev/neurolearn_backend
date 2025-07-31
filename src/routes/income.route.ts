import express from 'express';
import { getUserIncome } from '../controllers/income.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

/**
 * @swagger
 * /income/{userId}:
 *   get:
 *     summary: Lấy thông tin thu nhập của giảng viên
 *     tags:
 *       - Income
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của giảng viên
 *     responses:
 *       200:
 *         description: Lấy thông tin thu nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 incomeData:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "665f1a2b3c4d5e6f7a8b9c0d"
 *                     userId:
 *                       type: string
 *                       example: "665f1a2b3c4d5e6f7a8b9c0f"
 *                     totalIncome:
 *                       type: number
 *                       example: 15000000
 *                     totalPurchased:
 *                       type: number
 *                       example: 120
 *                     total:
 *                       type: array
 *                       items:
 *                         type: number
 *                       example: [1000000, 1200000, 900000, 0, 0, 0, 0, 0, 0, 0, 0, 0]
 *       401:
 *         description: Không có quyền truy cập hoặc chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Không đủ quyền (không phải instructor)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/:userId', updateAccessToken, isAuthenticated, authorizeRoles('instructor'), getUserIncome);

export = router;
