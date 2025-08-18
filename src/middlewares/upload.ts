import multer from "multer";

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

export const instructorUpload = upload.fields([
    { name: 'docImages', maxCount: 10 }
]);