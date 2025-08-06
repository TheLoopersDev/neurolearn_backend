import express from 'express';
import { createPaymentLink } from '../controllers/payment.controller';
import { updateAccessToken } from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';

const router = express.Router();

/**
 * @swagger
 * /api/payment/create-payment-link:
 *   post:
 *     summary: Tạo link thanh toán PayOS cho người dùng hoặc doanh nghiệp
 *     description:
 *       Tạo một đường dẫn thanh toán qua PayOS.
 *       - `description` không được dài hơn 25 ký tự.
 *       - `courseIds` phải là mảng các ObjectId hợp lệ.
 *       - Nếu người dùng thuộc doanh nghiệp và có quyền `admin` thì sẽ được ghi nhận là `business` khi tạo đơn hàng.
 *     tags: [Payment]
 *     security:
 *       - cookieAuth: []
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
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Số tiền cần thanh toán (đã áp dụng giảm giá nếu có)
 *                 example: 100000
 *               description:
 *                 type: string
 *                 description: Mô tả giao dịch (tối đa 25 ký tự)
 *                 example: "Thanh toán khóa học React"
 *               courseIds:
 *                 type: array
 *                 description: Danh sách ID các khóa học cần thanh toán
 *                 items:
 *                   type: string
 *                 example: ["66512f221e3efb486f7a4082", "66512f221e3efb486f7a4083"]
 *               licenseQuantities:
 *                 type: object
 *                 description: Số lượng license mua cho từng khóa học (nếu thanh toán theo dạng license cho doanh nghiệp)
 *                 additionalProperties:
 *                   type: number
 *                 example:
 *                   "66512f221e3efb486f7a4082": 5
 *                   "66512f221e3efb486f7a4083": 2
 *               discountCode:
 *                 type: string
 *                 description: Mã giảm giá áp dụng (nếu có)
 *                 example: "SALE50"
 *     responses:
 *       200:
 *         description: Tạo link thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 checkoutUrl:
 *                   type: string
 *                   example: "https://sandbox.payos.vn/payment-link/abcxyz"
 *       400:
 *         description: Thiếu trường bắt buộc hoặc dữ liệu không hợp lệ (ví dụ: mô tả quá 25 ký tự)
 *       500:
 *         description: Lỗi server khi tạo link thanh toán
 */

router.post('/create-payment-link', updateAccessToken, isAuthenticated, createPaymentLink);

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
