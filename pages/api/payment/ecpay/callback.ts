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

class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// 交易時間驗證：交易必須在 30 分鐘內完成
const MAX_PAYMENT_TIME_MINUTES = 30;

// 速率限制：記錄最近的請求時間和次數
const requestLog: { [ip: string]: { count: number, lastRequest: number } } = {};
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分鐘
const RATE_LIMIT_MAX_REQUESTS = 10; // 每分鐘最多 10 次請求

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

// 檢查速率限制
function checkRateLimit(ip: string | string[] | undefined): boolean {
  if (!ip) return false;
  
  const clientIp = Array.isArray(ip) ? ip[0] : ip;
  const now = Date.now();
  
  // 如果是首次請求，初始化記錄
  if (!requestLog[clientIp]) {
    requestLog[clientIp] = { count: 1, lastRequest: now };
    return true;
  }
  
  const record = requestLog[clientIp];
  
  // 如果已經超過時間窗口，重置計數
  if (now - record.lastRequest > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.lastRequest = now;
    return true;
  }
  
  // 增加計數並更新最後請求時間
  record.count++;
  record.lastRequest = now;
  
  // 檢查是否超過限制
  return record.count <= RATE_LIMIT_MAX_REQUESTS;
}

export default async function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  // 記錄請求方法和來源 IP
  const requestIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`ECPay callback received from ${requestIP}, method: ${req.method}`);

  // 1. 檢查請求方法
  if (req.method !== 'POST') {
    console.warn(`Invalid request method: ${req.method} from ${requestIP}`);
    return res.status(405).send('Method Not Allowed');
  }

  // 2. 速率限制
  if (!checkRateLimit(requestIP)) {
    console.warn(`Rate limit exceeded for IP: ${requestIP}`);
    return res.status(429).send('Too Many Requests');
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

    // 3. 驗證 CheckMacValue
    const isValid = validateCheckMacValue(data, hashKey, hashIV);

    if (!isValid) {
      throw new ValidationError('ECPay CheckMacValue validation failed');
    }

    const donationId = data.CustomField1;
    const rtnCode = data.RtnCode; // 1 代表成功

    if (!donationId) {
      throw new ValidationError('Missing CustomField1 (donationId) in callback data');
    }

    // 4. 查找原始捐款記錄
    const originalDonation = await prisma.donation.findUnique({
      where: { id: donationId }
    });

    if (!originalDonation) {
      throw new PaymentProcessingError(`Donation not found: ${donationId}`);
    }

    // 5. 交易金額驗證
    const callbackAmount = parseInt(data.TradeAmt);
    if (callbackAmount !== originalDonation.amount) {
      throw new SecurityError(`Amount mismatch: expected ${originalDonation.amount}, got ${callbackAmount}`);
    }

    // 6. 交易時間驗證
    const paymentTime = new Date(data.PaymentDate);
    const donationTime = new Date(originalDonation.createdAt);
    const timeDiffMinutes = (paymentTime.getTime() - donationTime.getTime()) / (1000 * 60);
    
    if (timeDiffMinutes < 0 || timeDiffMinutes > MAX_PAYMENT_TIME_MINUTES) {
      throw new SecurityError(`Payment time outside acceptable range: ${timeDiffMinutes.toFixed(2)} minutes`);
    }

    // 7. 狀態驗證：避免重複處理
    if (originalDonation.status === 'SUCCESS') {
      console.warn(`Donation ${donationId} already marked as successful`);
      return res.status(200).send('1|OK'); // 返回成功，但不重複處理
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
    
    if (error instanceof SecurityError) {
      console.error('ECPay security error:', error.message);
      return res.status(403).send('0|SecurityError');
    }

    // 處理其他未預期的錯誤
    console.error('ECPay Callback Error:', error);
    return res.status(500).send('0|InternalServerError');
  }
}