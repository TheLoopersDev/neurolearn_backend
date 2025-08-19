import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

export const businessUpload = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'docImages', maxCount: 10 }
]);

export const instructorUpload = upload.fields([{ name: 'docImages', maxCount: 10 }]);

export const uploadQuizCover = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
}).single('image');