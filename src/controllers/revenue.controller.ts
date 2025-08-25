import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import Revenue from '../models/Revenue.model';
import * as revenueService from '../services/revenue.service';

export const getRevenueByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let userId = req.user._id.toString();
  if (req.user.role === 'admin' && req.query.userId) {
    userId = req.query.userId;
  }
  const revenue = await Revenue.find({ user: userId }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    revenue
  });
});

// API: GET /api/revenue/income/me
export const getMyIncome = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user._id.toString();
  const income = await revenueService.calculateInstructorIncome(userId);
  res.status(200).json({ success: true, income });
});

// API: GET /api/revenue/income/:userId
export const getInstructorIncomeById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId param' });
  const income = await revenueService.calculateInstructorIncome(userId);
  res.status(200).json({ success: true, income });
});

// API: GET /api/revenue/submission/me
export const getMySubmission = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user._id.toString();
  const submission = await revenueService.calculateRevenueSubmission(userId);
  res.status(200).json({ 
    success: true, 
    submission,
    message: 'Submission amount (10% of total revenue)'
  });
});

// API: GET /api/revenue/submission/:userId
export const getInstructorSubmissionById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId param' });
  const submission = await revenueService.calculateRevenueSubmission(userId);
  res.status(200).json({ 
    success: true, 
    submission,
    message: 'Submission amount (10% of total revenue)'
  });
});

// API: GET /api/revenue/detailed/me
export const getMyDetailedRevenue = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user._id.toString();
  const revenueData = await revenueService.getRevenueWithSubmission(userId);
  res.status(200).json({ 
    success: true, 
    data: revenueData,
    message: 'Detailed revenue information with submission calculation'
  });
});

// API: GET /api/revenue/detailed/:userId
export const getInstructorDetailedRevenueById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId param' });
  const revenueData = await revenueService.getRevenueWithSubmission(userId);
  res.status(200).json({ 
    success: true, 
    data: revenueData,
    message: 'Detailed revenue information with submission calculation'
  });
}); 

// API test đơn giản
export const testAllSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  console.log('Testing API...');
  
  // Test đơn giản
  res.status(200).json({
    success: true,
    message: 'API is working',
    data: {
      test: 'Hello World',
      timestamp: new Date().toISOString()
    }
  });
});

// API đơn giản để test
export const simpleAllSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  console.log('Starting simple API...');
  
  // Test đơn giản với Revenue model và populate user
  const revenues = await Revenue.find({})
    .populate('user', 'name email avatar')
    .limit(5)
    .lean();
  
  console.log('Found revenues:', revenues.length);
  
  const submissions = revenues.map(revenue => {
    const user = revenue.user as any;
    return {
      userId: revenue.user._id || revenue.user,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userAvatar: user?.avatar?.url || user?.avatar || null,
      total: revenue.total || 0,
      submission: (revenue.total || 0) * 0.1,
      withdrawn: revenue.withdrawn || 0,
      available: (revenue.total || 0) - ((revenue.total || 0) * 0.1) - (revenue.withdrawn || 0)
    };
  });
  
  res.status(200).json({
    success: true,
    data: {
      submissions,
      count: submissions.length
    },
    message: 'Simple submissions data retrieved successfully'
  });
});

// API: GET /api/revenue/all-submissions (Admin only)
export const getAllInstructorsSubmissions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  console.log('Starting getAllInstructorsSubmissions...');
  
  const { page = 1, limit = 20, sortBy = 'submission', sortOrder = 'desc' } = req.query;
  
  console.log('Query params:', { page, limit, sortBy, sortOrder });
  
  // Gọi service với try-catch riêng
  let allSubmissions;
  try {
    allSubmissions = await revenueService.getAllInstructorsSubmission();
    console.log('Service call successful, submissions count:', allSubmissions.length);
  } catch (serviceError) {
    console.error('Service error, trying backup method:', serviceError);
    try {
      allSubmissions = await revenueService.getAllInstructorsSubmissionBackup();
      console.log('Backup method successful, submissions count:', allSubmissions.length);
    } catch (backupError) {
      console.error('Backup method also failed:', backupError);
      res.status(500).json({
        success: false,
        message: 'Error fetching submissions from both methods',
        error: backupError instanceof Error ? backupError.message : 'Unknown service error'
      });
      return;
    }
  }
  
  // Sorting
  if (sortBy === 'submission') {
    allSubmissions.sort((a, b) => sortOrder === 'desc' ? b.submission - a.submission : a.submission - b.submission);
  } else if (sortBy === 'total') {
    allSubmissions.sort((a, b) => sortOrder === 'desc' ? b.total - a.total : a.total - b.total);
  } else if (sortBy === 'available') {
    allSubmissions.sort((a, b) => sortOrder === 'desc' ? b.available - a.available : a.available - b.available);
  } else if (sortBy === 'withdrawn') {
    allSubmissions.sort((a, b) => sortOrder === 'desc' ? b.withdrawn - a.withdrawn : a.withdrawn - b.withdrawn);
  }
  
  // Pagination
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const totalItems = allSubmissions.length;
  const totalPages = Math.ceil(totalItems / limitNum);
  
  const paginatedSubmissions = allSubmissions.slice(skip, skip + limitNum);
  
  console.log('Pagination info:', { pageNum, limitNum, totalItems, totalPages, resultCount: paginatedSubmissions.length });
  
  res.status(200).json({
    success: true,
    data: {
      submissions: paginatedSubmissions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    },
    message: 'All instructors submission data retrieved successfully'
  });
});

// API: GET /api/revenue/submission-statistics (Admin only)
export const getSubmissionStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const statistics = await revenueService.getSubmissionStatistics();
  
  res.status(200).json({
    success: true,
    data: statistics,
    message: 'Submission statistics retrieved successfully'
  });
});

// API: GET /api/revenue/submissions-summary (Admin only)
export const getSubmissionsSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { top = 10 } = req.query;
  const topNum = Number(top);
  
  const allSubmissions = await revenueService.getAllInstructorsSubmission();
  const topSubmissions = allSubmissions.slice(0, topNum);
  const statistics = await revenueService.getSubmissionStatistics();
  
  res.status(200).json({
    success: true,
    data: {
      topSubmissions,
      statistics,
      summary: {
        topEarners: topSubmissions.length,
        totalInstructors: statistics.totalInstructors,
        activeInstructors: statistics.activeInstructors
      }
    },
    message: 'Submissions summary retrieved successfully'
  });
}); 
