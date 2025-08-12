import { UserT } from '../interfaces/User';

declare global {
    namespace Express {
        interface Request {
            user?: UserT;
            access_token?: string;
        }
    }
}
