import { Request, Response, NextFunction } from 'express';
import { CartModel } from '../models/Cart.model';
import ErrorHandler from '../utils/ErrorHandler';

export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, quantity } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        return next(new ErrorHandler('User not authenticated', 401));
    }

    try {
        const cart = await CartModel.findOne({ userId });

        if (cart) {
            const courseIndex = cart.items.findIndex(
                (item: { courseId: { toString: () => any } }) => item.courseId.toString() === courseId
            );
            if (courseIndex >= 0) {
                cart.items[courseIndex].quantity += quantity;
            } else {
                cart.items.push({ courseId, quantity });
            }
            await cart.save();
        } else {
            const newCart = new CartModel({
                userId,
                items: [{ courseId, quantity }]
            });
            await newCart.save();
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

    if (!userId) {
        return next(new ErrorHandler('User not authenticated', 401));
    }

    try {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return next(new ErrorHandler('Cart not found', 404));
        }
        const itemIndex = cart.items.filter((item: { courseId: string }) => item.courseId === courseId);
        if (itemIndex >= 0) {
            cart.items.splice(itemIndex, 1);
            await cart.save();
            res.status(200).json({ success: true, message: 'Item removed from cart' });
        } else {
            return next(new ErrorHandler('Item not found in cart', 404));
        }
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
