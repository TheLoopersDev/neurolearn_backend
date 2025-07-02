import UserModel from '../models/User.model';
import { redis } from '../utils/redis';
import { Response } from 'express';

export const getUserById = async (id: string, res: Response) => {
    try {
        const user = await UserModel.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
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
    const user = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    await redis.set(id, JSON.stringify(user));
    res.status(200).json({
        success: true,
        user
    });
};

export const getAllInstructorsService = async (res: Response) => {
    const instructors = await UserModel.find({ role: 'instructor' }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        instructors
    });
};
