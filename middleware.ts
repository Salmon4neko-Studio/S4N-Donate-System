import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
    // 只保護 dashboard 路由
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        const authToken = request.cookies.get('auth_token');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        console.log('Middleware check:', { 
            path: request.nextUrl.pathname,
            hasToken: !!authToken
        });

        if (!authToken) {
            console.log('No auth token found, redirecting to login');
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            // 驗證 JWT token
            const decoded = jwt.verify(authToken.value, JWT_SECRET);
            console.log('Token verified successfully:', { username: decoded.username });
            
            // 將用戶信息添加到請求頭，以便在API中使用
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user', JSON.stringify(decoded));
            
            // 繼續請求，並附加修改後的請求頭
            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                }
            });
        } catch (error) {
            console.error('Token verification failed:', error);
            // Token 無效或已過期
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/dashboard/:path*',
};