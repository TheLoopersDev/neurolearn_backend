import { Request, Response, NextFunction } from 'express';
import { CartModel } from '../models/Cart.model';
import ErrorHandler from '../utils/ErrorHandler';

export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { courseId } = req.body;
    const userId = req.user?._id;
    const businessRole = req.user?.businessInfo?.role;

    if (!userId) {
        next(new ErrorHandler('User not authenticated', 401));
        return;
    }

    if (!courseId) {
        next(new ErrorHandler('Course ID is required', 400));
        return;
    }

    try {
        const isBusiness = ['admin', 'manager'].includes(businessRole);
        const quantityToAdd = 1;

        let cart = await CartModel.findOne({ userId });

        if (!cart) {
            cart = new CartModel({
                userId,
                items: [{ courseId, quantity: quantityToAdd }]
            });
            await cart.save();
        } else {
            const existingItem = cart.items.find((item: any) => item.courseId.toString() === courseId.toString());

            if (existingItem) {
                if (isBusiness) {
                    existingItem.quantity += quantityToAdd;
                } else {
                    res.status(400).json({
                        success: false,
                        message: 'Course already in cart'
                    });
                    return;
                }
            } else {
                cart.items.push({ courseId, quantity: quantityToAdd });
            }

            await cart.save();
        }

        res.status(201).json({ success: true, message: 'Added to cart successfully' });
    } catch (error) {
        next(error);
    }
};

export const getCartItems = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
        return next(new ErrorHandler('User not authenticated', 401));
    }

    try {
        const cart = await CartModel.findOne({ userId }).populate({
            path: 'items.courseId',
            select: 'name price thumbnail'
        });
        res.status(200).json({ success: true, cart });
    } catch (error) {
        next(error);
    }
};

export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.body;
    const userId = req.user?._id;

    if (!userId) return next(new ErrorHandler('User not authenticated', 401));
    if (!courseId) return next(new ErrorHandler('Course ID is required', 400));

    try {
        const cart = await CartModel.findOne({ userId });
        if (!cart) return next(new ErrorHandler('Cart not found', 404));

        const initialLength = cart.items.length;
        cart.items = cart.items.filter((item: any) => item.courseId.toString() !== courseId.toString());

        if (cart.items.length === initialLength) {
            return next(new ErrorHandler('Item not found in cart', 404));
        }

        await cart.save();
        res.status(200).json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        next(error);
    }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
        return next(new ErrorHandler('User not authenticated', 401));
    }

    try {
        const cart = await CartModel.findOne({ userId });
        if (cart) {
            cart.items = [];
            await cart.save();
            res.status(200).json({ success: true, message: 'Cart cleared successfully' });
        } else {
            res.status(200).json({ success: true, message: 'Cart cleared successfully (no cart found)' });
        }
    } catch (error) {
        next(error);
    }
};
