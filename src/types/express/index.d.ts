import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            access_token?: string;
            user?: any;
            file?: Multer.File;
            files?: { [fieldname: string]: Multer.File[] };
        }
        
        namespace Multer {
            interface File {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                destination: string;
                filename: string;
                path: string;
                buffer: Buffer;
            }
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
