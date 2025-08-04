import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import IncomeModel from '../models/Income.model';
import OrderModel from '../models/Order.model';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '../utils/catchAsync';

export const getUserIncome = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return next(new ErrorHandler('Invalid user ID', 400));
    }

    const orders = await OrderModel.find({}).populate({
        path: 'courseIds',
        select: 'authorId price purchased createdAt'
    });

    const monthlyIncome = Array(12).fill(0);
    const monthlyPurchased = Array(12).fill(0);
    let totalIncome = 0;
    let totalPurchased = 0;

    orders.forEach((order) => {
        order.courseIds.forEach((course: any) => {
            if (course.authorId.toString() === userId) {
                const month = new Date(order.createdAt).getMonth();
                const income = course.price * course.purchased;
                const incomeAfterCommission = income * 0.9;

                monthlyIncome[month] += incomeAfterCommission;
                monthlyPurchased[month] += course.purchased;

                totalIncome += incomeAfterCommission;
                totalPurchased += course.purchased;
            }
        });
    });

    const incomeData = await IncomeModel.findOneAndUpdate(
        { userId },
        {
            totalIncome,
            totalPurchased,
            total: monthlyIncome
        },
        { new: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        incomeData
    });
});

export const getUserIncomeChart = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return next(new ErrorHandler('Invalid user ID', 400));
    }

    // Lấy tất cả orders kèm course chi tiết
    const orders = await OrderModel.find({}).populate({
        path: 'courseIds',
        select: 'authorId price purchased'
    });

    // Khởi tạo dữ liệu month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = Array(12).fill(0);
    const yearlyData: Record<string, number> = {};

    // Duyệt toàn bộ order và tính doanh thu
    orders.forEach((order) => {
        const orderDate = new Date(order.createdAt);
        const month = orderDate.getMonth();
        const year = orderDate.getFullYear().toString();

        order.courseIds.forEach((course: any) => {
            if (course.authorId.toString() === userId) {
                const incomeAfterCommission = course.price * course.purchased * 0.9;

                // Thống kê theo tháng
                monthlyData[month] += incomeAfterCommission;

                // Thống kê theo năm
                yearlyData[year] = (yearlyData[year] || 0) + incomeAfterCommission;
            }
        });
    });

    // Convert sang format Recharts
    const monthlyChart = months.map((m, i) => ({
        name: m,
        revenue: Math.round(monthlyData[i])
    }));

    const yearlyChart = Object.entries(yearlyData).map(([year, revenue]) => ({
        name: year,
        revenue: Math.round(revenue)
    }));

    res.status(200).json({
        success: true,
        monthlyChart,
        yearlyChart
    });
});
