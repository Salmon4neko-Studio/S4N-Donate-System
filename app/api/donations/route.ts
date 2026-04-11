import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCheckMacValue } from '@/lib/payment';

// 自定義錯誤類型，用於區分不同的錯誤情況
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigError';
  }
}

export async function GET() {
  try {
    const donations = await prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(donations);
  } catch (error) {
    console.error('Failed to fetch donations:', error);
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, message, donorName, paymentMethod } = body;

    // 輸入驗證
    if (!amount) {
      throw new ValidationError('Missing required field: amount');
    }
    if (!donorName) {
      throw new ValidationError('Missing required field: donorName');
    }
    if (!paymentMethod) {
      throw new ValidationError('Missing required field: paymentMethod');
    }

    // 驗證金額是否為有效數字
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new ValidationError('Invalid amount: must be a positive number');
    }

    // 建立贊助紀錄
    const donation = await prisma.donation.create({
      data: {
        amount: parsedAmount,
        message,
        donorName,
        paymentMethod,
        status: 'PENDING',
      },
    });

    // 準備支付參數 - 修正日期格式為 yyyy/MM/dd HH:mm:ss
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const merchantTradeDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    console.log('Generated MerchantTradeDate:', merchantTradeDate); // 記錄生成的日期格式以便調試

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
        throw new PaymentConfigError('ECPay credentials not fully configured');
      }

      const baseParams = {
        MerchantID: merchantID,
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
        hashKey,
        hashIV
      );

      paymentParams = { ...baseParams, CheckMacValue: checkMacValue };
      // 始終使用正式環境連結
      actionUrl = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

    } else if (paymentMethod === 'OPAY') {
      // O'Pay 歐付寶
      const merchantID = process.env.OPAY_MERCHANT_ID;
      const hashKey = process.env.OPAY_HASH_KEY;
      const hashIV = process.env.OPAY_HASH_IV;

      if (!merchantID || !hashKey || !hashIV) {
        throw new PaymentConfigError('OPay credentials not fully configured');
      }

      const baseParams = {
        MerchantID: merchantID,
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
        hashKey,
        hashIV
      );

      paymentParams = { ...baseParams, CheckMacValue: checkMacValue };
      // 始終使用正式環境連結
      actionUrl = 'https://payment.opay.tw/Cashier/AioCheckOut/V5';
    } else {
      throw new ValidationError(`Invalid payment method: ${paymentMethod}`);
    }

    return NextResponse.json({
      donationId: donation.id,
      paymentParams,
      actionUrl,
    });

  } catch (error) {
    // 根據錯誤類型返回不同的錯誤訊息和狀態碼
    if (error instanceof ValidationError) {
      console.warn('Validation error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error instanceof PaymentConfigError) {
      console.error('Payment configuration error:', error.message);
      return NextResponse.json({ error: 'Payment service configuration error' }, { status: 503 });
    }

    // 處理其他未預期的錯誤
    console.error('Donation creation error:', error);
    
    // 避免在生產環境洩露詳細的錯誤信息
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : `Error: ${(error as Error).message}`;
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}