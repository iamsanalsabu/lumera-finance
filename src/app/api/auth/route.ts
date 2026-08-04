import { NextResponse } from 'next/server';
import { signJwtToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Since it's a single user app, we just find or create a default user
    let user = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { username: 'admin' }
      });
    }

    const token = await signJwtToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({ success: true });
    
    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
