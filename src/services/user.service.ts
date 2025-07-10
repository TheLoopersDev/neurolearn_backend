import UserModel from '../models/User.model';
import { redis } from '../utils/redis';
import { Response } from 'express';

export const getUserById = async (id: string, res: Response) => {
    try {
        const userId = id.toString();
        // Check Redis cache first
        const userJSON = await redis.get(userId);
        if (userJSON) {
            const user = JSON.parse(userJSON);
            return res.status(200).json({
                success: true,
                user
            });
        }
        // If not in cache, get from DB
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Cache user in Redis
        await redis.set(userId, JSON.stringify(user));
        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error in getUserById:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getAllUsersService = async (res: Response) => {
    const users = await UserModel.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        users
    });
};

export const updateUserRoleService = async (res: Response, id: string, role: string) => {
    try {
        const userId = id.toString();
        const user = await UserModel.findByIdAndUpdate(userId, { role }, { new: true });
        
        if (user) {
            await redis.set(userId, JSON.stringify(user));
            res.status(200).json({
                success: true,
                user
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    } catch (error) {
        console.error('Error in updateUserRoleService:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getAllInstructorsService = async (res: Response) => {
    const instructors = await UserModel.find({ role: 'instructor' }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        instructors
    });
};

export const getUserInfoForChat = async (userId: string) => {
    return await UserModel.findById(userId, '_id name avatar email');
};

export const getAllUsersForChat = async () => {
    try {
        const users = await UserModel.find({}, '_id name avatar email role').sort({ name: 1 });
        return users;
    } catch (error) {
        console.error('Error in getAllUsersForChat service:', error);
        throw error;
    }
};
