import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB nếu cần
    }
});
