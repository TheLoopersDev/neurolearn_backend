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

    const user = await UserModel.findOne({ email });
    if (!user) return next(new ErrorHandler('User not found', 404));

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
    const { businessId } = req.params;

    const business = await BusinessModel.findById(businessId)
        .populate('employees.user') // populate all user information of employees
        .populate('courses'); // populate all courses in the business

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

    const filteredEmployees = business.employees.filter((emp: any) => allowedRolesToView.includes(emp.role));

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
        $unset: { businessInfo: '' }
    });

    res.status(200).json({
        success: true,
        message: 'Employee removed from business successfully'
    });
});
  
