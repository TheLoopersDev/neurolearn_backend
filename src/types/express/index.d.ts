import { UserT } from '../interfaces/User';
import { Multer } from 'multer';

declare global {
    namespace Express {
        interface Request {
            user?: UserT;
            access_token?: string;
        }
        export interface Request {
            file?: Multer.File;
            files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
        }
    }
}
