import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith('/login')) {
    return session ? NextResponse.redirect(new URL('/grafik', req.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/|favicon.ico|.*\\.(?:png|svg|ico|jpg)$).*)'] };
