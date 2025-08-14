import { UserT } from '../interfaces/User';

declare global {
    namespace Express {
        namespace Multer {
            interface File {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                destination?: string;
                filename?: string;
                path?: string;
                buffer: Buffer;
                stream?: import('stream').Readable;
            }
        }
        interface Request {
            user?: UserT;
            access_token?: string;
            file?: Multer.File;
            files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
        }
    }
}
