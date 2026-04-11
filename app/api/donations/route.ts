import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCheckMacValue } from '@/lib/payment';

export async function GET() {
    try {
        const donations = await prisma.donation.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return NextResponse.json(donations);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { amount, message, donorName, paymentMethod } = body;

        if (!amount || !donorName || !paymentMethod) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 建立贊助紀錄
        const donation = await prisma.donation.create({
            data: {
                amount: parseInt(amount),
                message,
                donorName,
                paymentMethod,
                status: 'PENDING',
            },
        });

        // 準備支付參數
        const merchantTradeDate = new Date().toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).replace(/\//g, '/');

        const merchantTradeNo = donation.id.replace(/-/g, '').substring(0, 20);

        // Update donation with the generated MerchantTradeNo as paymentId
        await prisma.donation.update({
            where: { id: donation.id },
            data: { paymentId: merchantTradeNo }
        });

        let actionUrl: string;
        let paymentParams: any;

        if (paymentMethod === 'ECPAY') {
            // ECPay 綠界科技
            const merchantID = process.env.ECPAY_MERCHANT_ID;
            const hashKey = process.env.ECPAY_HASH_KEY;
            const hashIV = process.env.ECPAY_HASH_IV;

            if (!merchantID || !hashKey || !hashIV) {
                console.warn('ECPay credentials not fully configured');
            }

            const baseParams = {
                MerchantID: merchantID || '',
                MerchantTradeNo: merchantTradeNo,
                MerchantTradeDate: merchantTradeDate,
                PaymentType: 'aio',
                TotalAmount: donation.amount,
                TradeDesc: 'Streamer Donation',
                ItemName: `Donation from ${donorName}`,
                ReturnURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/ecpay/callback`,
                ChoosePayment: 'ALL',
                EncryptType: 1,
                CustomField1: donation.id, // ECPay supports CustomField1, keeping it.
            };

            const checkMacValue = generateCheckMacValue(
                baseParams,
                hashKey || '',
                hashIV || ''
            );

            paymentParams = { ...baseParams, CheckMacValue: checkMacValue };
            actionUrl = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'; // 正式環境

        } else if (paymentMethod === 'OPAY') {
            // O'Pay 歐付寶
            const merchantID = process.env.OPAY_MERCHANT_ID;
            const hashKey = process.env.OPAY_HASH_KEY;
            const hashIV = process.env.OPAY_HASH_IV;

            if (!merchantID || !hashKey || !hashIV) {
                console.warn('OPay credentials not fully configured');
            }

            const baseParams = {
                MerchantID: merchantID || '',
                MerchantTradeNo: merchantTradeNo,
                MerchantTradeDate: merchantTradeDate,
                PaymentType: 'aio',
                TotalAmount: donation.amount,
                TradeDesc: 'Streamer Donation',
                ItemName: `Donation from ${donorName}`,
                ReturnURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/opay/callback`,
                ChoosePayment: 'ALL',
                EncryptType: 1,
                // CustomField1 removed as it causes "Parameter Error"
            };

            const checkMacValue = generateCheckMacValue(
                baseParams,
                hashKey || '',
                hashIV || ''
            );

            paymentParams = { ...baseParams, CheckMacValue: checkMacValue };
            actionUrl = 'https://payment.opay.tw/Cashier/AioCheckOut/V5'; // 正式環境

        } else {
            return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
        }

        return NextResponse.json({
            donationId: donation.id,
            paymentParams,
            actionUrl,
        });

    } catch (error) {
        console.error('Donation creation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}