import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import CategoryModel from '../models/Category.model';
import SubCategoryModel from '../models/SubCategory.model';

export const createCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { title } = req.body;

    if (!title) {
        return next(new ErrorHandler('Please provide a category title', 400));
    }

    const category = await CategoryModel.create({
        title
    });

    res.status(201).json({
        success: true,
        category
    });
});

export const createSubCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { title } = req.body;
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    if (!category) {
        return next(new ErrorHandler('Category not found', 404));
    }

    if (!title) {
        return next(new ErrorHandler('Please provide a sub-category title', 400));
    }

    const subCategory = await SubCategoryModel.create({
        title,
        categoryId: id
    });

    res.status(201).json({
        success: true,
        subCategory
    });
});

export const getCategories = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const categories = await CategoryModel.find();
    res.status(200).json({
        success: true,
        categories
    });
});

export const getSubCategoriesByCategoryId = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    if (!category) {
        return next(new ErrorHandler('Category not found', 404));
    }

    const subCategories = await SubCategoryModel.find({ categoryId: id }).populate('categoryId');

    res.status(200).json({
        success: true,
        subCategories
    });
});

export const getCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    res.status(200).json({
        success: true,
        category
    });
});
export const getAllCategoriesWithSubcategories = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const categories = await CategoryModel.find();
    const subCategories = await SubCategoryModel.find();

    const result = categories.map((category) => {
        const categorySubCategories = subCategories
            .filter((subCat) => subCat.categoryId.toString() === category._id.toString())
            .map((subCat) => ({
                _id: subCat._id,
                title: subCat.title
            }));

        return {
            _id: category._id,
            title: category.title,
            courses: category.courses,
            subCategories: categorySubCategories
        };
    });

    res.status(200).json({
        success: true,
        categories: result
    });
});

// TEMP/ADMIN: Seed default subcategories for known categories
export const seedSubCategories = catchAsync(async (req: Request, res: Response) => {
    // Map categoryId -> array of subcategory titles to ensure
    const seedMap: Record<string, string[]> = {
        // Information Technology
        '67c99c438ecc018ebef9a6b9': [
            'Sales',
            'Networking & Security',
            'Computer Hardware & Maintenance',
            'IT Project Management',
            'Operating Systems (Windows, Linux, macOS)',
            'IT Support & Helpdesk',
        ],
        // Web Development
        '6885f79a16bf7137523d1c4c': [
            'Frontend Development (HTML, CSS, JavaScript, React, Vue)',
            'Backend Development (Node.js, PHP, Python Django)',
            'Fullstack Development',
            'Web Performance Optimization',
            'Web Accessibility & SEO',
        ],
        // Mobile Development
        '6885f79a16bf7137523d1c4d': [
            'Android Development (Java, Kotlin)',
            'iOS Development (Swift, Objective-C)',
            'Cross-platform Development (React Native, Flutter)',
            'Mobile UI/UX Design',
            'Mobile App Testing & Deployment',
        ],
        // Artificial Intelligence
        '6885f79a16bf7137523d1c4e': [
            'Machine Learning Fundamentals',
            'Deep Learning & Neural Networks',
            'Natural Language Processing (NLP)',
            'Computer Vision',
            'AI in Business & Automation',
        ],
        // Data Science
        '6885f79a16bf7137523d1c4f': [
            'Data Analysis with Python/R',
            'Data Visualization (Tableau, Power BI)',
            'Statistical Modeling',
            'Big Data Tools (Hadoop, Spark)',
            'Data Engineering',
        ],
        // DevOps & Cloud
        '6885f79a16bf7137523d1c50': [
            'CI/CD Pipelines (Jenkins, GitHub Actions)',
            'Docker & Kubernetes',
            'Cloud Platforms (AWS, Azure, GCP)',
            'Infrastructure as Code (Terraform, Ansible)',
            'Monitoring & Logging (Prometheus, Grafana)',
        ],
    };

    let created = 0;
    let skipped = 0;

    for (const [categoryId, titles] of Object.entries(seedMap)) {
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            continue;
        }

        for (const title of titles) {
            const exists = await SubCategoryModel.findOne({ categoryId, title });
            if (exists) {
                skipped += 1;
                continue;
            }
            await SubCategoryModel.create({ categoryId, title });
            created += 1;
        }
    }

    res.status(200).json({ success: true, created, skipped });
});
