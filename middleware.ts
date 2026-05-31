import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/status',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    return NextResponse.next();
  }

  const visitorId = request.cookies.get('visitor_id')?.value;
  if (!visitorId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/api/auth/google', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
