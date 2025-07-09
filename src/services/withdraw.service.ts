import Withdraw, { IWithdraw } from '../models/Withdraw.model';
import { FilterQuery, UpdateQuery } from 'mongoose';

export const createWithdraw = async (data: Partial<IWithdraw>) => {
  return await Withdraw.create(data);
};

export const getWithdraws = async (filter: FilterQuery<IWithdraw> = {}) => {
  return await Withdraw.find(filter).populate('user');
};

export const getWithdrawById = async (id: string) => {
  return await Withdraw.findById(id).populate('user');
};

export const updateWithdrawStatus = async (
  id: string,
  update: UpdateQuery<IWithdraw>
) => {
  return await Withdraw.findByIdAndUpdate(id, update, { new: true });
}; 