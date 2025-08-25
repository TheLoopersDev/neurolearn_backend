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


export const increaseWithdrawn = async (userId: string, amount: number) => {
  return await Revenue.findOneAndUpdate(
    { user: userId },
    { $inc: { withdrawn: amount }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );
};

/**
 * Tính tổng thu nhập của giáo viên từ các order đã bán khóa học
 * @param userId - id của giáo viên
 * @returns tổng thu nhập (đã trừ chiết khấu 10%)
 */
export const calculateInstructorIncome = async (userId: string) => {
  const revenueDoc = await Revenue.findOne({ user: userId });
  if (!revenueDoc) return 0;
  const total = revenueDoc.total || 0;
  const submission = total * 0.1;
  const withdrawn = (revenueDoc as any).withdrawn || 0;
  const available = total - submission - withdrawn;
  return Math.max(Math.round(available * 100) / 100, 0);
};

/**
 * Tính submission của revenue (10% của tổng revenue)
 * @param userId - id của giáo viên
 * @returns submission amount (10% của revenue)
 */
export const calculateRevenueSubmission = async (userId: string) => {
  const revenueDoc = await Revenue.findOne({ user: userId });
  if (!revenueDoc || revenueDoc.total <= 0) {
    return 0;
  }
  
  // Tính 10% của revenue
  const submission = revenueDoc.total * 0.1;
  return Math.round(submission * 100) / 100; // Làm tròn đến 2 chữ số thập phân
};

/**
 * Lấy thông tin chi tiết về revenue và submission
 * @param userId - id của giáo viên
 * @returns object chứa total revenue và submission
 */
export const getRevenueWithSubmission = async (userId: string) => {
  const revenueDoc = await Revenue.findOne({ user: userId });
  if (!revenueDoc) {
    return {
      total: 0,
      submission: 0,
      netIncome: 0,
      withdrawn: 0,
      available: 0
    };
  }
  
  const total = revenueDoc.total;
  const submission = total * 0.1;
  const withdrawn = (revenueDoc as any).withdrawn || 0;
  const netIncome = total - submission;
  const available = netIncome - withdrawn;
  
  return {
    total: total,
    submission: Math.round(submission * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    withdrawn: Math.round(withdrawn * 100) / 100,
    available: Math.max(Math.round(available * 100) / 100, 0)
  };
};

/**
 * Lấy submission của toàn bộ instructor
 * @returns Array chứa thông tin submission của tất cả instructor
 */
export const getAllInstructorsSubmission = async () => {
  try {
    // Lấy tất cả revenue với populate user data
    const allRevenues = await Revenue.find({})
      .populate('user', 'name email avatar')
      .lean();
    
    const instructorsSubmission = allRevenues.map(revenue => {
      const total = revenue.total || 0;
      const submission = total * 0.1;
      const withdrawn = revenue.withdrawn || 0;
      const netIncome = total - submission;
      const available = netIncome - withdrawn;
      
      // Lấy user data từ populated field
      const user = revenue.user as any;
      const userName = user?.name || 'Unknown';
      const userEmail = user?.email || 'Unknown';
      
      // Xử lý avatar field
      let userAvatar = null;
      if (user?.avatar) {
        if (typeof user.avatar === 'string') {
          userAvatar = user.avatar;
        } else if (user.avatar.url) {
          userAvatar = user.avatar.url;
        } else if (user.avatar.public_id) {
          userAvatar = user.avatar.public_id;
        }
      }
      
      return {
        userId: revenue.user._id || revenue.user,
        userName,
        userEmail,
        userAvatar,
        total: Math.round(total * 100) / 100,
        submission: Math.round(submission * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
        withdrawn: Math.round(withdrawn * 100) / 100,
        available: Math.max(Math.round(available * 100) / 100, 0),
        updatedAt: revenue.updatedAt
      };
    });
    
    // Sắp xếp theo submission giảm dần
    return instructorsSubmission.sort((a, b) => b.submission - a.submission);
  } catch (error) {
    console.error('Error in getAllInstructorsSubmission:', error);
    throw error;
  }
};

/**
 * Lấy thống kê tổng quan về submission của toàn bộ instructor
 * @returns Object chứa thống kê tổng quan
 */
export const getSubmissionStatistics = async () => {
  const allRevenues = await Revenue.find({});
  
  const totalRevenue = allRevenues.reduce((sum, revenue) => sum + (revenue.total || 0), 0);
  const totalSubmission = allRevenues.reduce((sum, revenue) => sum + ((revenue.total || 0) * 0.1), 0);
  const totalWithdrawn = allRevenues.reduce((sum, revenue) => sum + ((revenue as any).withdrawn || 0), 0);
  const totalAvailable = totalRevenue - totalSubmission - totalWithdrawn;
  
  const activeInstructors = allRevenues.filter(revenue => (revenue.total || 0) > 0).length;
  const totalInstructors = allRevenues.length;
  
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalSubmission: Math.round(totalSubmission * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    totalAvailable: Math.max(Math.round(totalAvailable * 100) / 100, 0),
    activeInstructors,
    totalInstructors,
    averageSubmission: totalInstructors > 0 ? Math.round((totalSubmission / totalInstructors) * 100) / 100 : 0
  };
};

/**
 * Lấy submission của toàn bộ instructor (backup method)
 * @returns Array chứa thông tin submission của tất cả instructor
 */
export const getAllInstructorsSubmissionBackup = async () => {
  try {
    // Lấy tất cả revenue trước
    const allRevenues = await Revenue.find({}).lean();
    
    // Lấy danh sách user IDs
    const userIds = allRevenues.map(revenue => revenue.user);
    
    // Import User model
    const User = require('../models/User.model').default;
    const users = await User.find({ _id: { $in: userIds } }, 'name email avatar').lean();
    
    // Tạo map để lookup user data
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });
    
    const instructorsSubmission = allRevenues.map(revenue => {
      const total = revenue.total || 0;
      const submission = total * 0.1;
      const withdrawn = revenue.withdrawn || 0;
      const netIncome = total - submission;
      const available = netIncome - withdrawn;
      
      // Lấy user data từ map
      const user = userMap.get(revenue.user.toString());
      const userName = user?.name || 'Unknown';
      const userEmail = user?.email || 'Unknown';
      
      // Xử lý avatar field
      let userAvatar = null;
      if (user?.avatar) {
        if (typeof user.avatar === 'string') {
          userAvatar = user.avatar;
        } else if (user.avatar.url) {
          userAvatar = user.avatar.url;
        } else if (user.avatar.public_id) {
          userAvatar = user.avatar.public_id;
        }
      }
      
      return {
        userId: revenue.user,
        userName,
        userEmail,
        userAvatar,
        total: Math.round(total * 100) / 100,
        submission: Math.round(submission * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
        withdrawn: Math.round(withdrawn * 100) / 100,
        available: Math.max(Math.round(available * 100) / 100, 0),
        updatedAt: revenue.updatedAt
      };
    });
    
    // Sắp xếp theo submission giảm dần
    return instructorsSubmission.sort((a, b) => b.submission - a.submission);
  } catch (error) {
    console.error('Error in getAllInstructorsSubmissionBackup:', error);
    throw error;
  }
};