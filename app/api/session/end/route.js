// Прекратява невалидна сесия (деактивиран профил, сменена парола) и води към входа.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const had = req.cookies.has(SESSION_COOKIE);
  const res = NextResponse.redirect(new URL(had ? '/login?ended=1' : '/login', req.url), 307);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
