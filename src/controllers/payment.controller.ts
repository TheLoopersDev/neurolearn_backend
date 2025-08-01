import { Request, Response } from 'express';
import { payos } from '../utils/payos';
import Order from '../models/Order.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CourseModel from '../models/Course.model';
import BusinessModel from '../models/Business.model';
import RevenueModel from '../models/Revenue.model';
import UserModel from '../models/User.model';
import { validateAndCalculateDiscount } from '../services/discount.service';
import DiscountModel from '../models/Discount.model';

dotenv.config();

const clientUrl = process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : 'http://localhost:3000';

// =======================
// Tạo link thanh toán PayOS
// =======================
export const createPaymentLink = async (req: Request, res: Response): Promise<void> => {
    try {
        let { amount, description, courseIds, licenseQuantities, discountCode } = req.body;
        const userId = req.user?._id;

        if (!amount || !description || !Array.isArray(courseIds) || !userId) {
            res.status(400).json({ error: 'Missing required field' });
            return;
        }

        if (description.length > 25) {
            res.status(400).json({ error: 'Description must not be greater than 25 characters' });
            return;
        }

        const orderCode = Math.floor(Math.random() * 1_000_000);

        const paymentLinkRes = await payos.createPaymentLink({
            orderCode,
            amount, // FE đã gửi giá sau giảm
            description,
            returnUrl: `${clientUrl}/dashboard/purchase-history/${orderCode}`,
            cancelUrl: `${clientUrl}`,
            extraData: JSON.stringify({ userId, courseIds })
        } as any);

        const userType =
            req.user?.businessInfo?.role === 'admin' || req.user?.businessInfo?.role === 'manager'
                ? 'business'
                : 'user';

        await Order.create({
            userId,
            courseIds: courseIds.map((id: string) => new mongoose.Types.ObjectId(id)),
            licenseQuantities: licenseQuantities || {},
            payment_info: 'PayOS',
            orderCode,
            discountCode: discountCode || null,
            price: amount, // chỉ lưu giá đã giảm
            userType
        });

        res.json({ checkoutUrl: paymentLinkRes.checkoutUrl });
    } catch (error) {
        console.error('❌ Error create payment link:', error);
        res.status(500).json({ error: 'Error create payment link' });
    }
};

// =======================
// Webhook PayOS
// =======================
export const payosWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        // const rawBody = req.body.toString('utf8');
        // const webhookData = JSON.parse(rawBody);
        // console.log(webhookData);

        // if (webhookData?.code !== '00' || !webhookData?.data?.orderCode) {
        //     res.sendStatus(400);
        //     return;
        // }

        // const orderCode = webhookData?.data.orderCode;
        // const order = await Order.findOne({ orderCode });
        // if (!order) {
        //     console.warn('❌ Không tìm thấy đơn hàng:', orderCode);
        //     res.status(404).send('Order not found');
        //     return;
        // }

        // const user = await UserModel.findById(order.userId);
        // if (!user) {
        //     console.warn('❌ Không tìm thấy người dùng:', order.userId);
        //     res.status(404).send('User not found');
        //     return;
        // }

        // // ✅ Nếu có discountCode thì tăng usedCount
        // if (order.discountCode) {
        //     await DiscountModel.updateOne({ code: order.discountCode }, { $inc: { usedCount: 1 } });
        // }

        // const licenseQuantitiesRaw = order.licenseQuantities;
        // const licenseQuantities: Record<string, number> =
        //     licenseQuantitiesRaw instanceof Map
        //         ? Object.fromEntries(Array.from(licenseQuantitiesRaw.entries()))
        //         : licenseQuantitiesRaw || {};

        // const role = user.businessInfo?.role;
        // const isBusiness = ['admin', 'manager'].includes(role);

        // if (isBusiness) {
        //     const business = await BusinessModel.findOne({
        //         _id: user.businessInfo.businessId
        //     });
        //     if (!business) {
        //         console.warn('❌ Không tìm thấy doanh nghiệp cho user:', user._id);
        //         res.status(404).send('Business not found');
        //         return;
        //     }

        //     for (const [courseIdStr, quantity] of Object.entries(licenseQuantities)) {
        //         if (!mongoose.Types.ObjectId.isValid(courseIdStr)) continue;
        //         const courseId = new mongoose.Types.ObjectId(courseIdStr);

        //         const existingCourse = business.courses.find((c: any) => c.course.toString() === courseId.toString());

        //         if (existingCourse) {
        //             existingCourse.totalLicenses += quantity;
        //         } else {
        //             business.courses.push({ course: courseId, totalLicenses: quantity });
        //         }

        //         await CourseModel.findByIdAndUpdate(courseId, {
        //             $inc: { purchased: quantity }
        //         });
        //     }

        //     await business.save();
        //     await updateRevenueForCourses(licenseQuantities, order.price);
        // } else {
        //     const courseIds = Object.keys(licenseQuantities)
        //         .filter((id) => mongoose.Types.ObjectId.isValid(id))
        //         .map((id) => new mongoose.Types.ObjectId(id));

        //     const newCourseIds = courseIds.filter(
        //         (id) => !user.purchasedCourses.some((existingId: any) => existingId.toString() === id.toString())
        //     );

        //     if (newCourseIds.length > 0) {
        //         user.purchasedCourses.push(...newCourseIds);
        //         await user.save();
        //     }

        //     await Promise.all(
        //         courseIds.map((courseId) => CourseModel.findByIdAndUpdate(courseId, { $inc: { purchased: 1 } }))
        //     );

        //     await updateRevenueForCourses(licenseQuantities, order.price);
        // }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Lỗi xử lý webhook:', error);
        res.sendStatus(500);
    }
};

// =======================
// Cập nhật doanh thu (đã hỗ trợ Discount)
// =======================
const updateRevenueForCourses = async (
    licenseQuantities: Record<string, number>,
    totalAfterDiscount: number
): Promise<void> => {
    const courseIds = Object.keys(licenseQuantities);
    const totalQuantityPrice = await Promise.all(
        courseIds.map(async (courseIdStr) => {
            const quantity = licenseQuantities[courseIdStr] || 1;
            const course = await CourseModel.findById(courseIdStr).select('price');
            return course ? course.price * quantity : 0;
        })
    );

    const totalBeforeDiscount = totalQuantityPrice.reduce((sum, v) => sum + v, 0);

    for (const courseIdStr of courseIds) {
        const quantity = licenseQuantities[courseIdStr] || 1;
        const course = await CourseModel.findById(courseIdStr).select('authorId price');
        if (!course) continue;

        // phân bổ doanh thu theo tỉ lệ giá gốc
        const proportion = (course.price * quantity) / totalBeforeDiscount;
        const actualRevenue = totalAfterDiscount * proportion;

        const revenue = await RevenueModel.findOne({ user: course.authorId });
        if (revenue) {
            revenue.total += actualRevenue;
            revenue.updatedAt = new Date();
            await revenue.save();
        } else {
            await RevenueModel.create({
                user: course.authorId,
                total: actualRevenue,
                updatedAt: new Date()
            });
        }
    }
};
