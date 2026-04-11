import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET() {
    try {
        const cookieStore = cookies();
        const authToken = cookieStore.get('auth_token');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        if (!authToken) {
            return NextResponse.json({ authenticated: false });
        }

        try {
            // 驗證JWT令牌
            const decoded = jwt.verify(authToken.value, JWT_SECRET);
            return NextResponse.json({ 
                authenticated: true,
                user: { username: decoded.username }
            });
        } catch (error) {
            // 令牌無效
            return NextResponse.json({ authenticated: false, error: 'Invalid token' });
        }
    } catch (error) {
        return NextResponse.json({ 
            authenticated: false, 
            error: 'Server error',
            details: process.env.NODE_ENV !== 'production' ? String(error) : undefined
        });
    }
}