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

    employee.assignedCourses.push({
        course: course._id,
        startDate,
        dueDate,
        status: 'not_started'
    });

    await employee.save();

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
