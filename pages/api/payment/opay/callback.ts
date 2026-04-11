import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../socket/io';
import { prisma } from '@/lib/prisma';
import { validateCheckMacValue } from '@/lib/payment';

export const config = {
    api: {
        bodyParser: false,
    },
};

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
        console.log('OPay Callback Data:', data);

        const hashKey = process.env.OPAY_HASH_KEY;
        const hashIV = process.env.OPAY_HASH_IV;

        if (!hashKey || !hashIV) {
            console.error('OPay credentials not fully configured');
            return res.status(500).send('0|ConfigurationError');
        }

        const isValid = validateCheckMacValue(
            data,
            hashKey,
            hashIV
        );

        if (!isValid) {
            console.error('OPay CheckMacValue validation failed');
            return res.status(400).send('0|ErrorMessage');
        }

        const merchantTradeNo = data.MerchantTradeNo;
        const rtnCode = data.RtnCode;

        if (rtnCode === '1' && merchantTradeNo) {
            // Find donation by the MerchantTradeNo we saved in paymentId
            const donation = await prisma.donation.findFirst({
                where: { paymentId: merchantTradeNo }
            });

            if (donation) {
                const updatedDonation = await prisma.donation.update({
                    where: { id: donation.id },
                    data: {
                        status: 'SUCCESS',
                        paymentId: data.TradeNo, // Update to the real O'Pay TradeNo
                    },
                });

                if (res.socket.server.io) {
                    res.socket.server.io.emit('new-donation', updatedDonation);
                    console.log('Emitted new-donation event (OPay):', updatedDonation.id);
                }
            } else {
                console.warn('OPay Callback: Donation not found for MerchantTradeNo:', merchantTradeNo);
            }
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('OPay Callback Error:', error);
        res.status(500).send('0|ErrorMessage');
    }
}