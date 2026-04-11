import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../socket/io';
import { prisma } from '@/lib/prisma';
import { validateCheckMacValue } from '@/lib/payment';

export const config = {
    api: {
        bodyParser: false, // ECPay sends data as application/x-www-form-urlencoded
    },
};

// Helper to parse form data
const parseForm = (req: NextApiRequest): Promise<any> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const data = Buffer.concat(chunks).toString();
            const params = new URLSearchParams(data);
            const result: any = {};
            params.forEach((value, key) => {
                result[key] = value;
            });
            resolve(result);
        });
        req.on('error', reject);
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const data = await parseForm(req);
        console.log('ECPay Callback Data:', data);

        const hashKey = process.env.ECPAY_HASH_KEY;
        const hashIV = process.env.ECPAY_HASH_IV;

        if (!hashKey || !hashIV) {
            console.error('ECPay credentials not fully configured');
            return res.status(500).send('0|ConfigurationError');
        }

        const isValid = validateCheckMacValue(
            data,
            hashKey,
            hashIV
        );

        if (!isValid) {
            console.error('ECPay CheckMacValue validation failed');
            return res.status(400).send('0|ErrorMessage');
        }

        const donationId = data.CustomField1;
        const rtnCode = data.RtnCode; // 1 代表成功

        if (rtnCode === '1' && donationId) {
            // 更新資料庫
            const donation = await prisma.donation.update({
                where: { id: donationId },
                data: {
                    status: 'SUCCESS',
                    paymentId: data.TradeNo,
                },
            });

            // 發送 Socket.io 通知
            if (res.socket.server.io) {
                res.socket.server.io.emit('new-donation', donation);
                console.log('Emitted new-donation event:', donation.id);
            }
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('ECPay Callback Error:', error);
        res.status(500).send('0|ErrorMessage');
    }
}