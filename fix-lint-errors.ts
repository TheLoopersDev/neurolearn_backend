const fs = require('fs');
const path = require('path');

// Danh sách các file controller cần sửa
const controllerFiles = [
    'src/controllers/business.controller.ts',
    'src/controllers/user.controller.ts',
    'src/controllers/course.controller.ts',
    'src/controllers/cart.controller.ts',
    'src/controllers/category.controller.ts',
    'src/controllers/chat.controller.ts',
    'src/controllers/creditCard.controller.ts',
    'src/controllers/discount.controller.ts',
    'src/controllers/income.controller.ts',
    'src/controllers/layout.controller.ts',
    'src/controllers/lesson.controller.ts',
    'src/controllers/level.controller.ts',
    'src/controllers/notification.controller.ts',
    'src/controllers/order.controller.ts',
    'src/controllers/payment.controller.ts',
    'src/controllers/progress.controller.ts',
    'src/controllers/quiz.controller.ts',
    'src/controllers/request.controller.ts',
    'src/controllers/revenue.controller.ts',
    'src/controllers/section.controller.ts',
    'src/controllers/withdraw.controller.ts'
];

function fixLintErrors() {
    controllerFiles.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');

            // Sửa lỗi: Xóa tham số 'next' không sử dụng
            content = content.replace(
                /export const \w+ = catchAsync\(async \(req: Request, res: Response, next: NextFunction\) => \{/g,
                'export const $& = catchAsync(async (req: Request, res: Response) => {'
            );

            // Sửa lỗi: Xóa import không sử dụng
            content = content.replace(/import \{ [^}]*Types[^}]* \} from ['"]mongoose['"];?\n?/g, '');
            content = content.replace(/import \{ [^}]*Document[^}]* \} from ['"]mongoose['"];?\n?/g, '');

            // Sửa lỗi: Xóa biến không sử dụng
            content = content.replace(/const \w+ = req\.params\.\w+;\s*\n\s*if \(!req\.params\.\w+\)/g, '');

            fs.writeFileSync(filePath, content);
            console.log(`Fixed lint errors in ${filePath}`);
        }
    });
}

fixLintErrors();
console.log('Lint error fixing completed!');
