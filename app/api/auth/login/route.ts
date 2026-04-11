import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        console.log('Login attempt:', { username, providedUsername: adminUsername });

        if (!adminUsername || !adminPassword) {
            console.error('Server configuration error: Admin credentials not set');
            return NextResponse.json(
                { error: 'Server configuration error: Admin credentials not set' },
                { status: 500 }
            );
        }

        if (username === adminUsername && password === adminPassword) {
            // 生成 JWT token
            const token = jwt.sign(
                { username: adminUsername },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 設置cookie
            const cookieStore = cookies();
            
            // 確保cookie設置正確
            cookieStore.set('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: '/',
                sameSite: 'lax', // 允許同一站點內的跨頁面請求
            });

            console.log('Login successful, token generated');
            
            // 返回更多信息以幫助調試
            return NextResponse.json({ 
                success: true,
                message: 'Authentication successful',
                // 不要在生產環境中返回token，這裡僅用於調試
                debug: process.env.NODE_ENV !== 'production' ? { tokenSet: true } : undefined
            });
        }

        console.log('Invalid credentials');
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: process.env.NODE_ENV !== 'production' ? String(error) : undefined
        }, { status: 500 });
    }
}