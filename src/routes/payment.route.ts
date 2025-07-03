import express from 'express';
import { createPaymentLink, payosWebhook } from '../controllers/payment.controller';

const router = express.Router();

/**
 * @swagger
 * /api/payment/create-payment-link:
 *   post:
 *     summary: Tạo link thanh toán PayOS
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *               - courseIds
 *               - userId
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100000
 *               description:
 *                 type: string
 *                 example: "Thanh toán khóa học lập trình"
 *               courseIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["66512f221e3efb486f7a4082"]
 *               userId:
 *                 type: string
 *                 example: "6650e7f4c8b57965b0a9bc01"
 *     responses:
 *       200:
 *         description: Trả về URL thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checkoutUrl:
 *                   type: string
 *                   example: "https://sandbox.payos.vn/payment-link/abcxyz"
 *       500:
 *         description: Lỗi server
 */
router.post('/create-payment-link', createPaymentLink);

/**
 * @swagger
 * /api/payment/webhook:
 *   post:
 *     summary: Nhận webhook từ PayOS sau khi thanh toán thành công
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "PAID"
 *               orderCode:
 *                 type: number
 *                 example: 123456
 *               extraData:
 *                 type: string
 *                 example: '{"userId": "6650e7f4c8b57965b0a9bc01", "courseIds": ["66512f221e3efb486f7a4082"]}'
 *     responses:
 *       200:
 *         description: Đã nhận và xử lý webhook thành công
 *       500:
 *         description: Lỗi xử lý webhook
 */
// router.post('/webhook', express.raw({ type: 'application/json' }), payosWebhook);

export default router;
