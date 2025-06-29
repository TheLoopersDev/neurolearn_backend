import { Request, Response } from 'express';
import { payos, verifyWebhookSignature } from '../utils/payos';
import Order from '../models/Order.model';
import User from '../models/User.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const clientUrl = process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:3000';

const webhookUrl =
    process.env.NODE_ENV === 'production' ? process.env.PAYOS_WEBHOOK_URL : 'https://neurolearn-backend.onrender.com/api/payment/webhook';

export const createPaymentLink = async (req: Request, res: Response): Promise<void> => {
    try {
        const { amount, description, courseIds, userId } = req.body;

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
            returnUrl: `${clientUrl}/purchase-history/${orderCode}`,
            cancelUrl: `${clientUrl}`,
            webhookUrl,
            extraData: JSON.stringify({ userId, courseIds })
        } as any);

        res.json({ checkoutUrl: paymentLinkRes.checkoutUrl });
    } catch (error) {
        console.error('❌ Error create payment link:', error);
        res.status(500).json({ error: 'Error create payment link' });
    }
};

export const payosWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawBody = JSON.stringify(req.body);
        const signature = req.headers['x-signature'] as string;

        const isValid = verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            console.warn('❌ Webhook bị giả mạo');
            res.status(400).end();
            return;
        }

        const webhookData = req.body;
        if (webhookData.status === 'PAID') {
            const extraData = JSON.parse(webhookData.extraData || '{}');
            const userId = extraData.userId;
            const courseIds: string[] = extraData.courseIds;

            if (!userId || !Array.isArray(courseIds)) {
                res.status(400).end();
                return;
            }

            await User.findByIdAndUpdate(userId, {
                $addToSet: {
                    purchasedCourses: { $each: courseIds.map((id) => new mongoose.Types.ObjectId(id)) }
                }
            });

            await Order.create({
                userId,
                courseIds: courseIds.map((id) => new mongoose.Types.ObjectId(id)),
                payment_info: `PayOS orderCode: ${webhookData.orderCode}`
            });

            console.log('✅ Đã xử lý thanh toán');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Lỗi xử lý webhook:', error);
        res.sendStatus(500);
    }
};
