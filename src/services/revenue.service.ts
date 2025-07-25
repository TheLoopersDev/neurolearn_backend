import Revenue, { IRevenue } from '../models/Revenue.model';
import OrderModel from '../models/Order.model';
import CourseModel from '../models/Course.model';

export const getRevenueByUser = async (userId: string) => {
  return await Revenue.findOne({ user: userId });
};

export const increaseRevenue = async (userId: string, amount: number) => {
  return await Revenue.findOneAndUpdate(
    { user: userId },
    { $inc: { total: amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );
};

export const decreaseRevenue = async (userId: string, amount: number) => {
  return await Revenue.findOneAndUpdate(
    { user: userId },
    { $inc: { total: -amount }, $set: { updatedAt: new Date() } },
    { new: true }
  );
};

/**
 * Tính tổng thu nhập của giáo viên từ các order đã bán khóa học
 * @param userId - id của giáo viên
 * @returns tổng thu nhập (đã trừ chiết khấu 10%)
 */
export const calculateInstructorIncome = async (userId: string) => {
  // Lấy tất cả order, populate courseIds
  const orders = await OrderModel.find({}).populate({
    path: 'courseIds',
    select: 'authorId price',
  });

  let totalIncome = 0;

  orders.forEach((order: any) => {
    order.courseIds.forEach((course: any) => {
      if (course.authorId?.toString() === userId) {
        // Nếu cần nhân với số lượng, có thể lấy order.licenseQuantities
        totalIncome += course.price || 0;
      }
    });
  });

  // Trừ chiết khấu 10%
  const netIncome = totalIncome * 0.9;
  return netIncome;
}; 