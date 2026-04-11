import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../socket/io';
import { prisma } from '@/lib/prisma';
import { validateCheckMacValue } from '@/lib/payment';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 自定義錯誤類型，用於區分不同的錯誤情況
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class PaymentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProcessingError';
  }
}

const parseForm = (req: NextApiRequest): Promise<any> => {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const data = Buffer.concat(chunks).toString();
        const params = new URLSearchParams(data);
        const result: any = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse form data: ${(error as Error).message}`));
      }
    });
    req.on('error', (error) => {
      reject(new Error(`Error reading request data: ${error.message}`));
    });
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  // 記錄請求方法和來源 IP
  const requestIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`OPay callback received from ${requestIP}, method: ${req.method}`);

  if (req.method !== 'POST') {
    console.warn(`Invalid request method: ${req.method} from ${requestIP}`);
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = await parseForm(req);
    
    // 記錄回調數據，但排除敏感信息
    const { CheckMacValue, ...logSafeData } = data;
    console.log('OPay Callback Data:', logSafeData);

    const hashKey = process.env.OPAY_HASH_KEY;
    const hashIV = process.env.OPAY_HASH_IV;

    if (!hashKey || !hashIV) {
      throw new ConfigurationError('OPay credentials not fully configured');
    }

    const isValid = validateCheckMacValue(data, hashKey, hashIV);

    if (!isValid) {
      throw new ValidationError('OPay CheckMacValue validation failed');
    }

    const merchantTradeNo = data.MerchantTradeNo;
    const rtnCode = data.RtnCode;

    if (!merchantTradeNo) {
      throw new ValidationError('Missing MerchantTradeNo in callback data');
    }

    if (rtnCode === '1') {
      // Find donation by the MerchantTradeNo we saved in paymentId
      const donation = await prisma.donation.findFirst({
        where: { paymentId: merchantTradeNo }
      });

      if (!donation) {
        throw new PaymentProcessingError(`Donation not found for MerchantTradeNo: ${merchantTradeNo}`);
      }

      try {
        const updatedDonation = await prisma.donation.update({
          where: { id: donation.id },
          data: {
            status: 'SUCCESS',
            paymentId: data.TradeNo, // Update to the real O'Pay TradeNo
          },
        });

        // 發送 Socket.io 通知
        if (res.socket.server.io) {
          res.socket.server.io.emit('new-donation', updatedDonation);
          console.log(`Emitted new-donation event (OPay): ${updatedDonation.id}, amount: ${updatedDonation.amount}`);
        } else {
          console.warn('Socket.io server not available, notification not sent');
        }
      } catch (dbError) {
        throw new PaymentProcessingError(`Failed to update donation: ${(dbError as Error).message}`);
      }
    } else {
      console.warn(`Payment not successful. RtnCode: ${rtnCode}, RtnMsg: ${data.RtnMsg}`);
    }

    res.status(200).send('1|OK');
  } catch (error) {
    // 根據錯誤類型返回不同的錯誤訊息
    if (error instanceof ValidationError) {
      console.error('OPay validation error:', error.message);
      return res.status(400).send('0|ValidationError');
    }
    
    if (error instanceof ConfigurationError) {
      console.error('OPay configuration error:', error.message);
      return res.status(500).send('0|ConfigurationError');
    }
    
    if (error instanceof PaymentProcessingError) {
      console.error('OPay processing error:', error.message);
      return res.status(500).send('0|ProcessingError');
    }

    // 處理其他未預期的錯誤
    console.error('OPay Callback Error:', error);
    return res.status(500).send('0|InternalServerError');
  }
}