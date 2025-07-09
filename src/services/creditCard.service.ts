import { Types } from 'mongoose';
import CreditCard from '../models/CreditCard.model';
import ErrorHandler from '../utils/ErrorHandler';
import axios from 'axios';

export const getCreditCardByAccountNumber = async (accountNumber: string) => {
  const creditCard = await CreditCard.findOne({ accountNumber }).populate('user', 'name email');
  if (!creditCard) {
    throw new ErrorHandler('Credit card not found', 404);
  }
  return creditCard;
};

export const getCreditCardByUserId = async (userId: string | Types.ObjectId) => {
  const creditCard = await CreditCard.findOne({ user: userId });
  if (!creditCard) {
    throw new ErrorHandler('Credit card not found', 404);
  }
  return creditCard;
};

export const createCreditCardForUser = async (
  userId: string | Types.ObjectId,
  cardData: {
    name: string;
    accountNumber: string;
    cardType: string;
  }
) => {
  // Check if user already has a card
  const existingCard = await CreditCard.findOne({ user: userId });
  if (existingCard) {
    throw new ErrorHandler('User already has a credit card', 400);
  }

  // Check if account number is already used
  const existingAccountNumber = await CreditCard.findOne({ accountNumber: cardData.accountNumber });
  if (existingAccountNumber) {
    throw new ErrorHandler('Account number already exists', 400);
  }

  const creditCard = await CreditCard.create({
    ...cardData,
    user: userId,
  });

  return creditCard;
};

export const getBankInfoFromMoMo = async () => {
  const url = 'https://api.vietqr.io/v2/banks';
  const response = await axios.get(url);
  return response.data;
}; 