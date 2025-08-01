import DiscountModel from '../models/Discount.model';

interface ValidateDiscountParams {
    code: string;
    courseIds?: string[];
    totalAmount: number;
    userId?: string;
    userBusinessId?: string;
}

export const validateAndCalculateDiscount = async ({
    code,
    courseIds,
    totalAmount,
    userId,
    userBusinessId
}: ValidateDiscountParams) => {
    const discount = await DiscountModel.findOne({ code: code.toUpperCase() });

    if (!discount) throw new Error('Mã giảm giá không tồn tại');

    const now = new Date();

    // 1. Kiểm tra trạng thái & thời gian
    if (!discount.isActive) throw new Error('Mã giảm giá đã bị vô hiệu hóa');
    if (now < discount.startDate || now > discount.endDate) throw new Error('Mã giảm giá đã hết hạn hoặc chưa bắt đầu');

    // 2. Giới hạn số lần sử dụng
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit)
        throw new Error('Mã giảm giá đã đạt giới hạn sử dụng');

    // 3. Kiểm tra public/private
    if (discount.accessType === 'private') {
        const isUserAllowed = discount.allowedUsers?.some((u) => u.toString() === userId?.toString());
        const isBusinessAllowed = discount.allowedBusinesses?.some((b) => b.toString() === userBusinessId?.toString());

        if (!isUserAllowed && !isBusinessAllowed) {
            throw new Error('Mã giảm giá này không áp dụng cho bạn');
        }
    }

    // 4. Giới hạn course
    if (discount.courseIds && discount.courseIds.length > 0 && courseIds?.length) {
        const allowedCourseIds = discount.courseIds.map((id) => id.toString());
        const isValid = courseIds.some((c) => allowedCourseIds.includes(c));
        if (!isValid) throw new Error('Mã giảm giá không áp dụng cho các khóa học đã chọn');
    }

    // 5. Giá trị đơn hàng tối thiểu
    if (discount.minOrderAmount && totalAmount < discount.minOrderAmount)
        throw new Error(`Đơn hàng cần tối thiểu ${discount.minOrderAmount} để áp dụng mã`);

    // 6. Tính số tiền giảm
    let discountAmount = 0;
    if (discount.discountType === 'percentage') {
        discountAmount = (totalAmount * discount.amount) / 100;
    } else {
        discountAmount = discount.amount;
    }

    // Nếu có giới hạn số tiền giảm tối đa
    if ((discount as any).maxDiscountAmount && discountAmount > (discount as any).maxDiscountAmount) {
        discountAmount = (discount as any).maxDiscountAmount;
    }

    if (discountAmount > totalAmount) discountAmount = totalAmount;

    return {
        discount,
        discountAmount,
        totalAfterDiscount: totalAmount - discountAmount
    };
};
