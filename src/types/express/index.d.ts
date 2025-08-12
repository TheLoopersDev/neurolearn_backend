import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            access_token?: string;
            user?: any;
            file?: Express.Multer.File;
            files?: { [fieldname: string]: Express.Multer.File[] };
        }
    }
}

declare module 'express' {
    interface Request {
        access_token?: string;
        user?: any;
        file?: Express.Multer.File;
        files?: { [fieldname: string]: Express.Multer.File[] };
    }
}
