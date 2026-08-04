import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  // Only protect the root dashboard for now, or all pages except login/api
  const { pathname } = request.nextUrl;
  
  if (pathname === '/' || pathname.startsWith('/api/transactions') || pathname.startsWith('/api/budgets') || pathname.startsWith('/api/process-audio')) {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const secret = process.env.JWT_SECRET || '';
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch (error) {
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
