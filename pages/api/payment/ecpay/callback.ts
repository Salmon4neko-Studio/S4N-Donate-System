import { NextApiRequest } from 'next';
import { NextApiResponseServerIO } from '../../socket/io';
import { prisma } from '@/lib/prisma';
import { validateCheckMacValue } from '@/lib/payment';

export const config = {
  api: {
    bodyParser: false, // ECPay sends data as application/x-www-form-urlencoded
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

// Helper to parse form data
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
  console.log(`ECPay callback received from ${requestIP}, method: ${req.method}`);

  if (req.method !== 'POST') {
    console.warn(`Invalid request method: ${req.method} from ${requestIP}`);
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = await parseForm(req);
    
    // 記錄回調數據，但排除敏感信息
    const { CheckMacValue, ...logSafeData } = data;
    console.log('ECPay Callback Data:', logSafeData);

    const hashKey = process.env.ECPAY_HASH_KEY;
    const hashIV = process.env.ECPAY_HASH_IV;

    if (!hashKey || !hashIV) {
      throw new ConfigurationError('ECPay credentials not fully configured');
    }

    const isValid = validateCheckMacValue(data, hashKey, hashIV);

    if (!isValid) {
      throw new ValidationError('ECPay CheckMacValue validation failed');
    }

    const donationId = data.CustomField1;
    const rtnCode = data.RtnCode; // 1 代表成功

    if (!donationId) {
      throw new ValidationError('Missing CustomField1 (donationId) in callback data');
    }

    if (rtnCode === '1') {
      try {
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
          console.log(`Emitted new-donation event: ${donation.id}, amount: ${donation.amount}`);
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
      console.error('ECPay validation error:', error.message);
      return res.status(400).send('0|ValidationError');
    }
    
    if (error instanceof ConfigurationError) {
      console.error('ECPay configuration error:', error.message);
      return res.status(500).send('0|ConfigurationError');
    }
    
    if (error instanceof PaymentProcessingError) {
      console.error('ECPay processing error:', error.message);
      return res.status(500).send('0|ProcessingError');
    }

    // 處理其他未預期的錯誤
    console.error('ECPay Callback Error:', error);
    return res.status(500).send('0|InternalServerError');
  }
}