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