import PayOS from '@payos/node';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export const payos = new PayOS(
    process.env.PAYOS_CLIENT_ID!,
    process.env.PAYOS_API_KEY!,
    process.env.PAYOS_CHECKSUM_KEY!
);

export const verifyWebhookSignature = (rawBody: string, signature: string): boolean => {
    const secretKey = process.env.PAYOS_CHECKSUM_KEY!;
    const hmac = crypto.createHmac('sha256', secretKey);
    const digest = hmac.update(rawBody).digest('hex');
    return digest === signature;
};
