import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import UserModel from '../models/User.model';
import BusinessModel from '../models/Business.model';
import sendMail from '../utils/sendMail';
import XLSX from 'xlsx';
import fs from 'fs';
import CourseModel from '../models/Course.model';
import ProgressModel from '../models/Progress.model';
import cron from 'node-cron';
//add employee by email
export const addEmployeeByEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
        return next(new ErrorHandler('Email and role are required', 400));
    }

    const business = await BusinessModel.findById(businessId);
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) return next(new ErrorHandler('User not part of your business', 404));

    const alreadyInBusiness = business.employees.some((emp: any) => emp.user.toString() === user._id.toString());
    if (alreadyInBusiness) {
        return next(new ErrorHandler('User already in this business', 400));
    }

    user.businessInfo = {
        businessId: business._id,
        role: role
    };
    await user.save();

    business.employees.push({
        user: user._id,
        role: role
    });
    await business.save();

    await sendMail({
        email: user.email,
        subject: `You've been added to ${business.businessName}`,
        template: 'added-to-business.ejs',
        data: {
            user: { name: user.name },
            businessName: business.businessName,
            role
        }
    });

    res.status(200).json({
        success: true,
        message: `User ${user.name} added to business as ${role}`
    });
});

//add list of employees from excel file
export const importEmployeesFromExcel = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params;
    const file = req.file;

    if (!file) return next(new ErrorHandler('No file uploaded', 400));

    const business = await BusinessModel.findById(businessId);
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let success = 0,
        failed = 0,
        failedList: any[] = [];

    for (const row of data) {
        const email = (row as any).email?.toString().trim();
        const role = (row as any).role?.toString().toLowerCase() || 'employee';

        if (!email || !['admin', 'manager', 'employee'].includes(role)) {
            failed++;
            failedList.push({ email, reason: 'Invalid or missing role/email' });
            continue;
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            failed++;
            failedList.push({ email, reason: 'User not registered' });
            continue;
        }

        const alreadyIn = business.employees.find((emp: any) => emp.user.toString() === user._id.toString());
        if (alreadyIn) {
            failed++;
            failedList.push({ email, reason: 'Already in business' });
            continue;
        }

        // Cập nhật user
        user.businessInfo = {
            businessId: business._id,
            role
        };
        await user.save();

        // Thêm vào business
        business.employees.push({ user: user._id, role });
        success++;

        // Gửi mail
        await sendMail({
            email: user.email,
            subject: `You've been added to ${business.name}`,
            template: 'added-to-business.ejs',
            data: {
                user: { name: user.name },
                businessName: business.name,
                role
            }
        });
    }

    await business.save();
    fs.unlinkSync(file.path);

    res.status(200).json({
        success: true,
        message: `Import completed. ${success} added, ${failed} failed.`,
        failedList
    });
});

export const assignCourseToEmployee = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId, employeeId } = req.params;
    const { courseId, startDate, dueDate } = req.body;

    if (!courseId || !startDate || !dueDate) {
        return next(new ErrorHandler('Course ID, startDate and dueDate are required', 400));
    }

    const business = await BusinessModel.findById(businessId);
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const course = await CourseModel.findById(courseId);
    if (!course) return next(new ErrorHandler('Course not found', 404));

    const employee = await UserModel.findById(employeeId);
    if (!employee) return next(new ErrorHandler('Employee not found', 404));

    const isAlreadyAssigned = employee.assignedCourses.some((c: any) => c.course.toString() === courseId);
    if (isAlreadyAssigned) {
        return next(new ErrorHandler('Course already assigned to this employee', 400));
    }

    // 🔍 Tìm khóa học trong danh sách business.courses
    const businessCourse = business.courses.find((c: any) => c.course.toString() === courseId);
    if (!businessCourse) {
        return next(new ErrorHandler('Course not purchased by business', 400));
    }

    if (businessCourse.totalLicenses <= 0) {
        return next(new ErrorHandler('No available license for this course', 400));
    }

    // ✅ Gán course cho employee
    employee.assignedCourses.push({
        course: course._id,
        startDate,
        dueDate,
        status: 'not_started'
    });

    await employee.save();

    // ✅ Trừ license
    businessCourse.totalLicenses -= 1;
    await business.save();

    // ✅ Gửi mail
    await sendMail({
        email: employee.email,
        subject: `You’ve been assigned a new course: ${course.title}`,
        template: 'course-assigned.ejs',
        data: {
            user: { name: employee.name },
            course: { title: course.title },
            startDate: new Date(startDate).toLocaleDateString(),
            dueDate: new Date(dueDate).toLocaleDateString(),
            businessName: business.businessName
        }
    });

    res.status(200).json({
        success: true,
        message: `Course assigned to employee ${employee.name}`
    });
});

//get business infor by id
export const getBusinessById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as {
        businessInfo?: {
            businessId?: string;
        };
    };

    const businessId = user?.businessInfo?.businessId;

    const business = await BusinessModel.findById(businessId).populate('employees.user').populate('courses.course');

    if (!business) {
        return next(new ErrorHandler('Business not found', 404));
    }

    res.status(200).json({
        success: true,
        business
    });
});

export const checkEmployeeProgressDaily = () => {
    cron.schedule('* 7 * * *', async () => {
        const users = await UserModel.find({
            assignedCourses: { $exists: true, $ne: [] }
        });

        for (const user of users) {
            const behindCourses: string[] = [];

            let isUpdated = false;

            for (const assigned of user.assignedCourses) {
                const { course, startDate, dueDate } = assigned;

                if (!course || !startDate || !dueDate) continue;

                const progress = await ProgressModel.findOne({
                    user: user._id,
                    course
                });

                if (!progress || progress.totalLessons === 0) continue;

                const now = new Date();
                const totalTime = new Date(dueDate).getTime() - new Date(startDate).getTime();
                const elapsedTime = now.getTime() - new Date(startDate).getTime();

                const timeProgress = Math.min((elapsedTime / totalTime) * 100, 100);
                const learningProgress = (progress.totalCompleted / progress.totalLessons) * 100;

                // Cập nhật status
                if (progress.totalCompleted === 0 && now <= new Date(dueDate)) {
                    assigned.status = 'not_started';
                } else if (progress.totalCompleted === progress.totalLessons) {
                    assigned.status = 'completed';
                } else if (progress.totalCompleted > 0 && now <= new Date(dueDate)) {
                    assigned.status = 'in_progress';
                }

                isUpdated = true;

                // Kiểm tra nếu đang trễ tiến độ
                const isBehind = learningProgress < timeProgress;
                if (isBehind) {
                    const courseDoc = await CourseModel.findById(course);
                    behindCourses.push(courseDoc?.name || 'Khóa học không xác định');
                }
            }

            if (isUpdated) {
                await user.save();
            }

            if (behindCourses.length > 0) {
                await sendMail({
                    email: user.email,
                    subject: `Your course progress is behind schedule`,
                    template: 'progress-warning.ejs',
                    data: {
                        user: { name: user.name },
                        courses: behindCourses
                    }
                });
            }
        }
    });
};

// GET list employees of a business
export const getEmployeeList = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params;

    const business = await BusinessModel.findById(businessId).populate('employees.user', 'name email avatar');
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const employeeList = business.employees.filter((emp: any) => emp.role === 'employee');

    res.status(200).json({
        success: true,
        employees: employeeList
    });
});

// PUT update role of an employee to manager
export const upgradeEmployeeRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId, employeeId } = req.params;

    const business = await BusinessModel.findById(businessId);
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const employee = business.employees.find((emp: any) => emp.user.toString() === employeeId);
    if (!employee) return next(new ErrorHandler('Employee not found in this business', 404));

    if (employee.role === 'manager') {
        return next(new ErrorHandler('User is already a manager', 400));
    }

    employee.role = 'manager';

    const user = await UserModel.findById(employeeId);
    if (user && user.businessInfo && user.businessInfo.businessId.toString() === businessId) {
        user.businessInfo.role = 'manager';
        await user.save();
    }

    await business.save();

    res.status(200).json({
        success: true,
        message: 'Employee role updated to manager'
    });
});

// Get list employee
export const getEmployeesInBusiness = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
        return next(new ErrorHandler('Unauthorized', 401));
    }

    const business = await BusinessModel.findById(businessId).populate('employees.user', 'name email avatar');

    if (!business) {
        return next(new ErrorHandler('Business not found', 404));
    }

    const currentUser = business.employees.find((emp: any) => emp.user._id.toString() === currentUserId.toString());

    if (!currentUser) {
        return next(new ErrorHandler('You are not part of this business', 403));
    }

    let allowedRolesToView: string[] = [];

    if (currentUser.role === 'admin') {
        allowedRolesToView = ['manager', 'employee'];
    } else if (currentUser.role === 'manager') {
        allowedRolesToView = ['employee'];
    } else {
        return next(new ErrorHandler('You do not have permission to view this data', 403));
    }

    const filteredEmployees = business.employees
        .filter((emp: any) => allowedRolesToView.includes(emp.role))
        .map((emp: any) => ({
            _id: emp._id,
            role: emp.role,
            createdAt: emp.createdAt,
            user: emp.user,
            avatar: emp.user.avatar
        }));

    res.status(200).json({
        success: true,
        employees: filteredEmployees
    });
});

// remove employee from business
export const removeEmployeeFromBusiness = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId, employeeId } = req.params;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
        return next(new ErrorHandler('Unauthorized', 401));
    }

    const business = await BusinessModel.findById(businessId);

    if (!business) {
        return next(new ErrorHandler('Business not found', 404));
    }

    const currentUser = business.employees.find((emp: any) => emp.user.toString() === currentUserId.toString());
    if (!currentUser) {
        return next(new ErrorHandler('You are not a member of this business', 403));
    }

    const employeeToRemove = business.employees.find((emp: any) => emp.user.toString() === employeeId);
    if (!employeeToRemove) {
        return next(new ErrorHandler('Employee not found in this business', 404));
    }

    if (employeeId === currentUserId.toString()) {
        return next(new ErrorHandler('You cannot remove yourself', 400));
    }

    // Kiểm tra quyền xóa
    const canRemove =
        (currentUser.role === 'admin' && employeeToRemove.role !== 'admin') ||
        (currentUser.role === 'manager' && employeeToRemove.role === 'employee');

    if (!canRemove) {
        return next(new ErrorHandler('You do not have permission to remove this employee', 403));
    }

    // ✅ Xóa nhân viên khỏi business.employees
    business.employees = business.employees.filter((emp: any) => emp.user.toString() !== employeeId);
    await business.save();

    // ✅ Cập nhật user: gỡ liên kết businessInfo nếu có
    await UserModel.findByIdAndUpdate(employeeId, {
        $unset: { businessInfo: '', assignedCourses: '' }
    });

    res.status(200).json({
        success: true,
        message: 'Employee removed from business successfully'
    });
});

//Get statistics of a business
export const getBusinessStatistics = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { businessId } = req.params;

    const business = await BusinessModel.findById(businessId).populate('employees.user');
    if (!business) return next(new ErrorHandler('Business not found', 404));

    const totalEmployees = business.employees.filter((emp: any) => emp.role === 'employee').length;
    const totalManagers = business.employees.filter((emp: any) => emp.role === 'manager').length;
    const totalCourses = business.courses.length;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Khởi tạo thống kê tháng từ Jan đến Dec với giá trị mặc định là 0
    const employeeMonthlyData: { month: string; value: number }[] = monthNames.map((month) => ({
        month,
        value: 0
    }));

    const managerMonthlyData: { month: string; value: number }[] = monthNames.map((month) => ({
        month,
        value: 0
    }));

    for (const emp of business.employees) {
        const createdAt = new Date(emp.createdAt || emp.user?.createdAt || emp.user?._id?.getTimestamp());
        const monthIndex = createdAt.getMonth(); // 0-11

        if (emp.role === 'employee') {
            employeeMonthlyData[monthIndex].value += 1;
        } else if (emp.role === 'manager') {
            managerMonthlyData[monthIndex].value += 1;
        }
    }

    res.status(200).json({
        success: true,
        totalEmployees,
        totalManagers,
        totalCourses,
        employeeMonthlyData,
        managerMonthlyData
    });
});

// Get course with leaner in business
export const getCourseDetailWithLearners = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as {
        _id: string;
        businessInfo?: {
            businessId?: string;
        };
    };

    const { courseId } = req.params;
    const businessId = user?.businessInfo?.businessId;

    if (!businessId) {
        return next(new ErrorHandler('Business ID not found for current user', 400));
    }

    const business = await BusinessModel.findById(businessId).populate({
        path: 'courses.course',
        model: 'Course'
    });

    if (!business) return next(new ErrorHandler('Business not found', 404));

    const courseInfo = business.courses.find((c: any) => c.course._id.toString() === courseId);
    if (!courseInfo) return next(new ErrorHandler('Course not found in business', 404));

    const course = courseInfo.course;

    const learners = await UserModel.find({
        'businessInfo.businessId': businessId,
        assignedCourses: {
            $elemMatch: { course: course._id }
        }
    }).select('name email avatar assignedCourses');

    const learnersWithProgress = await Promise.all(
        learners.map(async (learner) => {
            const assigned = learner.assignedCourses.find((c: any) => c.course.toString() === courseId);
            const progress = await ProgressModel.findOne({
                user: learner._id,
                course: course._id
            });

            let learningProgress = 0;
            if (progress && progress.totalLessons > 0) {
                learningProgress = Math.round((progress.totalCompleted / progress.totalLessons) * 100);
            }

            return {
                _id: learner._id,
                name: learner.name,
                email: learner.email,
                avatar: learner.avatar,
                progress: learningProgress,
                enrollmentDate: assigned?.startDate,
                status: assigned?.status,
                startDate: assigned?.startDate,
                dueDate: assigned?.dueDate
            };
        })
    );

    res.status(200).json({
        success: true,
        course: {
            _id: course._id,
            name: course.name,
            description: course.description,
            subTitle: course.subTitle,
            thumbnail: course.thumbnail,
            author: course.author,
            sections: course.sections,
            rating: course.rating,
            price: course.price,
            totalLicenses: courseInfo.totalLicenses,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt
        },
        learners: learnersWithProgress
    });
});

export const getUnassignedEmployeesForCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as {
        _id: string;
        businessInfo?: {
            businessId?: string;
        };
    };

    const { courseId } = req.params;
    const businessId = user?.businessInfo?.businessId;

    if (!businessId) {
        return next(new ErrorHandler('Business ID not found in user info', 400));
    }

    const business = await BusinessModel.findById(businessId).populate(
        'employees.user',
        'name email avatar assignedCourses'
    );

    if (!business) {
        return next(new ErrorHandler('Business not found', 404));
    }

    const employees = business.employees.filter((emp: any) => emp.role === 'employee');

    const unassignedEmployees = employees.filter((emp: any) => {
        const user = emp.user;
        if (!user || !user.assignedCourses) return true;

        const isAssigned = user.assignedCourses.some((c: any) => c.course.toString() === courseId);
        return !isAssigned;
    });

    res.status(200).json({
        success: true,
        employees: unassignedEmployees
    });
});

// Get all businesses in database
export const getAllBusinesses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, search, isVerified } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};
    
    if (search) {
        filter.$or = [
            { businessName: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } },
            { businessSector: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (isVerified !== undefined) {
        filter.isVerified = isVerified === 'true';
    }

    // Get total count for pagination
    const totalBusinesses = await BusinessModel.countDocuments(filter);
    
    // Get businesses with pagination and populate
    const businesses = await BusinessModel.find(filter)
        .populate('createdBy', 'name email avatar')
        .populate('employees.user', 'name email avatar')
        .populate('courses.course', 'name description thumbnail price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    // Calculate pagination info
    const totalPages = Math.ceil(totalBusinesses / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
        success: true,
        data: businesses,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalBusinesses,
            hasNextPage,
            hasPrevPage,
            limit: limitNum
        }
    });
});

// Get business statistics for admin dashboard
export const getBusinessStatisticsForAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const totalBusinesses = await BusinessModel.countDocuments({});
    const verifiedBusinesses = await BusinessModel.countDocuments({ isVerified: true });
    const unverifiedBusinesses = await BusinessModel.countDocuments({ isVerified: false });
    
    // Get businesses created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentBusinesses = await BusinessModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
    });

    // Get top business sectors
    const sectorStats = await BusinessModel.aggregate([
        {
            $group: {
                _id: '$businessSector',
                count: { $sum: 1 }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 5
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            totalBusinesses,
            verifiedBusinesses,
            unverifiedBusinesses,
            recentBusinesses,
            sectorStats
        }
    });
});
