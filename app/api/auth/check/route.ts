import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose'; // 使用 jose 替代 jsonwebtoken

export async function GET() {
    try {
        // 在最新版本的 Next.js 中，cookies() 返回 Promise
        const authToken = (await cookies()).get('auth_token');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        if (!authToken) {
            return NextResponse.json({ authenticated: false });
        }

        try {
            // 使用 jose 驗證 JWT token
            const encoder = new TextEncoder();
            const secretKey = encoder.encode(JWT_SECRET);
            
            const { payload } = await jwtVerify(
                authToken.value,
                secretKey
            );
            
            return NextResponse.json({ 
                authenticated: true,
                user: { username: payload.username }
            });
        } catch (error) {
            // 令牌無效
            console.error('Token verification failed:', error);
            return NextResponse.json({ authenticated: false, error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json({ 
            authenticated: false, 
            error: 'Server error',
            details: process.env.NODE_ENV !== 'production' ? String(error) : undefined
        });
    }
}