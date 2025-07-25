import express from 'express';
import * as revenueController from '../controllers/revenue.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = express.Router();

/**
 * @swagger
 * /api/revenue:
 *   get:
 *     summary: Lấy doanh thu của giáo viên
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: (Admin) Xem doanh thu của instructor khác
 *     responses:
 *       200:
 *         description: Doanh thu của giáo viên
 *       401:
 *         description: Chưa xác thực
 */
router.get('/', isAuthenticated, revenueController.getRevenueByUser);
/**
 * @swagger
 * /api/revenue/income/me:
 *   get:
 *     summary: Lấy thu nhập của giáo viên hiện tại
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thu nhập của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 income:
 *                   type: number
 *       401:
 *         description: Chưa xác thực
 */
router.get('/income/me', isAuthenticated, revenueController.getMyIncome);

/**
 * @swagger
 * /api/revenue/income/{userId}:
 *   get:
 *     summary: (Admin) Xem thu nhập của giáo viên khác
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của giáo viên cần xem thu nhập
 *     responses:
 *       200:
 *         description: Thu nhập của giáo viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 income:
 *                   type: number
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get('/income/:userId', isAuthenticated, authorizeRoles('admin'), revenueController.getInstructorIncomeById);

export default router; 