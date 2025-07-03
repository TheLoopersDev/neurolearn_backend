import { Request, Response } from 'express';
import { payos, verifyWebhookSignature } from '../utils/payos';
import Order from '../models/Order.model';
import User from '../models/User.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const clientUrl = process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:3000';

export const createPaymentLink = async (req: Request, res: Response): Promise<void> => {
    try {
        const { amount, description, courseIds, userId, webhookUrl } = req.body;

        if (!amount || !description || !Array.isArray(courseIds) || !userId) {
            res.status(400).json({ error: 'Missing require field' });
            return;
        }

        if (description.length > 25) {
            res.status(400).json({ error: 'Description must not be great than 25' });
            return;
        }

        const orderCode = Math.floor(Math.random() * 1_000_000);

        const paymentLinkRes = await payos.createPaymentLink({
            orderCode,
            amount,
            description,
            returnUrl: `${clientUrl}/dashboard/purchase-history/${orderCode}`,
            cancelUrl: `${clientUrl}`,
            webhookUrl,
            extraData: JSON.stringify({ userId, courseIds })
        } as any);
        // Save Order vào DB để tra cứu khi webhook đến
        await Order.create({
            userId,
            courseIds: courseIds.map((id) => new mongoose.Types.ObjectId(id)),
            payment_info: `PayOS`,
            orderCode,
            price: amount
        });

        res.json({ checkoutUrl: paymentLinkRes.checkoutUrl });
    } catch (error) {
        console.error('❌ Error create payment link:', error);
        res.status(500).json({ error: 'Error create payment link' });
    }
};

export const payosWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawBody = req.body.toString('utf8'); // ✅ req.body là Buffer nếu dùng express.raw
        const signature = req.headers['x-signature'] as string;

        // const isValid = verifyWebhookSignature(rawBody, signature);
        // if (!isValid) {
        //     console.warn('❌ Webhook bị giả mạo');
        //     res.status(400).send('Invalid signature');
        //     return;
        // }

        const webhookData = JSON.parse(rawBody); // ✅ parse lại JSON

        if (webhookData?.code === '00' && webhookData?.data?.orderCode) {
            const orderCode = webhookData.data.orderCode;

            const order = await Order.findOne({ orderCode });
            if (!order) {
                console.warn('❌ Không tìm thấy đơn hàng với orderCode:', orderCode);
                res.status(404).send('Order not found');
                return;
            }

            const user = await User.findById(order.userId);
            if (!user) {
                console.warn('❌ Không tìm thấy người dùng:', order.userId);
                res.status(404).send('User not found');
                return;
            }

            // Push courseIds trực tiếp, không cần check
            const courseIds = order.courseIds.map((id: any) => new mongoose.Types.ObjectId(id));
            user.purchasedCourses.push(...courseIds);
            await user.save();

            console.log('✅ Đã thêm courseIds vào purchasedCourses');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Lỗi xử lý webhook:', error);
        res.sendStatus(500);
    }
};
