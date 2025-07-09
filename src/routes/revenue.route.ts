import express from 'express';
import * as revenueController from '../controllers/revenue.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';

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

export default router; 