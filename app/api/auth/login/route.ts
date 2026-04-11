import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';

        if (!adminUsername || !adminPassword) {
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

            const cookieStore = await cookies();
            cookieStore.set('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: '/',
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}