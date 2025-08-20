import Revenue, { IRevenue } from '../models/Revenue.model';

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
  const revenueDoc = await Revenue.findOne({ user: userId });
  return revenueDoc?.total || 0;
};