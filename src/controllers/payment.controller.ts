import { Request, Response } from 'express';
import { payos, verifyWebhookSignature } from '../utils/payos';
import Order from '../models/Order.model';
import User from '../models/User.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CourseModel from '../models/Course.model';
import BusinessModel from '../models/Business.model';

dotenv.config();

const clientUrl = process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:3000';

export const createPaymentLink = async (req: Request, res: Response): Promise<void> => {
    try {
        const { amount, description, courseIds, licenseQuantities, userId, webhookUrl } = req.body;

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
            licenseQuantities: licenseQuantities || [],
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
        const rawBody = req.body.toString('utf8');
        const signature = req.headers['x-signature'] as string;

        // ✅ Uncomment nếu cần verify chữ ký
        // const isValid = verifyWebhookSignature(rawBody, signature);
        // if (!isValid) {
        //     console.warn('❌ Webhook bị giả mạo');
        //     res.status(400).send('Invalid signature');
        //     return;
        // }

        // const webhookData = JSON.parse(rawBody);

        // if (webhookData?.code === '00' && webhookData?.data?.orderCode) {
        //     const orderCode = webhookData.data.orderCode;

        //     const order = await Order.findOne({ orderCode });
        //     if (!order) {
        //         console.warn('❌ Không tìm thấy đơn hàng với orderCode:', orderCode);
        //         res.status(404).send('Order not found');
        //         return;
        //     }

        //     const user = await User.findById(order.userId);
        //     if (!user) {
        //         console.warn('❌ Không tìm thấy người dùng:', order.userId);
        //         res.status(404).send('User not found');
        //         return;
        //     }

        //     const role = user.businessInfo?.role;
        //     const isBusiness = role === 'admin' || role === 'manager';

        //     if (isBusiness) {
        //         const business = await BusinessModel.findOne({ 'employees.user': user._id });
        //         if (!business) {
        //             console.warn('❌ Không tìm thấy doanh nghiệp cho user:', user._id);
        //             res.status(404).send('Business not found');
        //             return;
        //         }

        //         for (const item of order.licenseQuantities || []) {
        //             const courseId = new mongoose.Types.ObjectId(item.courseId);
        //             const quantity = item.quantity;

        //             const existingCourse = business.courses.find(
        //                 (c: any) => c.course.toString() === courseId.toString()
        //             );

        //             if (existingCourse) {
        //                 existingCourse.license += quantity;
        //             } else {
        //                 business.courses.push({ course: courseId, license: quantity });
        //             }

        //             await CourseModel.findByIdAndUpdate(courseId, {
        //                 $inc: { purchased: quantity }
        //             });
        //         }

        //         await business.save();
        //     } else {
        //         const courseIds = order.courseIds.map((id: any) => new mongoose.Types.ObjectId(id));

        //         user.purchasedCourses.push(...courseIds);
        //         await user.save();

        //         await Promise.all(
        //             courseIds.map(async (courseId: any) => {
        //                 await CourseModel.findByIdAndUpdate(courseId, {
        //                     $inc: { purchased: 1 }
        //                 });
        //             })
        //         );
        //     }
        // }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Lỗi xử lý webhook:', error);
        res.sendStatus(500);
    }
};
