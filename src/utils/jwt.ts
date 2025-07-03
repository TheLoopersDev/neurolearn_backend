import { UserT } from '../interfaces/User';
import { Response } from 'express';
import { redis } from '../utils/redis';

interface ITokenOptions {
    expires: Date;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none' | boolean;
    secure?: boolean;
    path?: string;
}

// Parse environment variables with fallback values
const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '3000', 10);
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '12000', 10);

// Options for cookies
export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
    maxAge: accessTokenExpire * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/'
    // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    // secure: process.env.NODE_ENV === 'production',
};

export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/'
};

export const sendToken = (user: UserT, statusCode: number, res: Response) => {
    const accessToken = user.signAccessToken();
    const refreshToken = user.signRefreshToken();

    // Upload session to Redis
    if (!user._id) {
        throw new Error('User ID is missing');
    }

    // Ensure user ID is stored as string in Redis
    const userId = user._id.toString();
    redis.set(userId, JSON.stringify(user));

    // Set cookies
    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);

    res.status(statusCode).json({
        success: true,
        user,
        accessToken
    });
};
