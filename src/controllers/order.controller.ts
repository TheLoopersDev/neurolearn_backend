// eslint-disable-next-line @typescript-eslint/no-var-requires
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
import mongoose from 'mongoose';
import ejs from 'ejs';

import { IOrder } from '../interfaces/Order';
import CourseModel from '../models/Course.model';
import UserModel from '../models/User.model';
import { getAllOrdersService, newOrder } from '../services/order.service';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';
import path from 'path';
import sendMail from '../utils/sendMail';
import NotificationModel from '../models/Notification.model';
import { redis } from '../utils/redis';
import OrderModel from '../models/Order.model';

// create order
export const createOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { courseIds, payment_info } = req.body as IOrder;

    // Validate courseIds
    if (!Array.isArray(courseIds)) {
        return next(new ErrorHandler('courseIds must be an array', 400));
    }

    if (!courseIds.length) {
        return next(new ErrorHandler('No course IDs provided', 400));
    }

    // Validate payment
    if (payment_info && 'id' in payment_info) {
        const paymentIntentId = payment_info.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return next(new ErrorHandler('Payment not authorized', 400));
        }
    }

    // Find user
    const user = await UserModel.findById(req.user?._id);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Find courses
    const courses = await CourseModel.find({ _id: { $in: courseIds } });

    if (courses.length !== courseIds.length) {
        return next(new ErrorHandler('One or more courses not found', 404));
    }

    // Check if user has already purchased any of the courses
    const alreadyPurchasedCourses = user.purchasedCourses.filter((c: any) => courseIds.includes(c._id.toString()));

    if (alreadyPurchasedCourses.length > 0) {
        return next(new ErrorHandler('You have already purchased one or more of these courses', 400));
    }

    // Prepare data for order creation
    const data: any = {
        courseIds: courses.map((course) => course._id),
        userId: user._id
    };

    // Prepare email data
    const mailData = {
        order: {
            _id: new mongoose.Types.ObjectId().toString().slice(0, 6),
            courses: courses.map((course) => ({
                name: course.name,
                price: course.price
            })),
            date: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        }
    };

    // Render email template
    await ejs.renderFile(path.join(__dirname, '../mails/order-confirmation.ejs'), {
        order: mailData.order
    });

    // Send email
    try {
        await sendMail({
            email: user.email,
            subject: 'Order Confirmation',
            template: 'order-confirmation.ejs',
            data: mailData
        });
    } catch (error: any) {
        return next(new ErrorHandler(`Failed to send order confirmation email: ${error.message}`, 500));
    }

    // Update user's purchased courses
    user.purchasedCourses.push(...courses.map((course) => course._id));

    await user.save();
    // Update Redis cache
    if (req.user?._id) {
        await redis.set(req.user._id, JSON.stringify(user));
    }

    // Save user

    // Create notifications for each course
    await Promise.all(
        courses.map(async (course) => {
            await NotificationModel.create({
                user: user._id,
                title: 'New Order',
                message: `You have a new order for ${course.name}`,
                courseId: course._id,
                authorId: course.authorId
            });
        })
    );

    // Update purchased count for each course
    for (const course of courses) {
        course.purchased = course.purchased ? course.purchased + 1 : 1;
        await course.save();
    }
    await redis.del(`allOrders ${req.user?._id}`);
    await redis.del('allOrders undefined');
    // Create the order
    newOrder(data, next, res);
});

// get all orders -- for admin
export const getAllOrders = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    getAllOrdersService(res);
});

// get single order
export const getOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const orderCode = req.params.id;

    if (!orderCode) {
        return next(new ErrorHandler('Please provide order id', 400));
    }

    const order = await OrderModel.findOne({ orderCode }).populate('userId').populate('courseIds');

    if (!order) {
        return next(new ErrorHandler('Order not found', 404));
    }

    res.status(200).json({
        success: true,
        order
    });
});
// send stripe publish key
export const sendStripePublishKey = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// new payment
export const newPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const myPayment = await stripe.paymentIntents.create({
        amount: req.body.amount,
        currency: 'USD',
        metadata: {
            company: 'UpSkill'
        },
        automatic_payment_methods: {
            enabled: true
        }
    });

    res.status(201).json({
        success: true,
        client_secret: myPayment.client_secret
    });
});

// get all orders of a specific user with Redis caching
export const getUserOrders = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    let orders = await OrderModel.find({ userId })
        .populate({
            path: 'courseIds'
        })
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        orders
    });
});
