import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
    // 只保護 dashboard 路由
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        const authToken = request.cookies.get('auth_token');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        if (!authToken) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            // 驗證 JWT token
            jwt.verify(authToken.value, JWT_SECRET);
        } catch (error) {
            // Token 無效或已過期
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/dashboard/:path*',
};