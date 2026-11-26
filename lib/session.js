import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'puls_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

// Автоматичен изход при неактивност важи само за служебния акаунт с това потребителско име
export const TIMEOUT_USERNAME = 'admin';
// Обикновените потребители: сесия с фиксирана продължителност от входа
export const REGULAR_SESSION_SECONDS = 12 * 60 * 60;

// payload: { uid, la, to } – la = последна активност (сек. от 1970 г.), to = важи автоматичният изход
export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    // admin: горна граница, реалното изтичане е по неактивност (la); останалите – 12 часа
    .setExpirationTime(payload.to ? '2d' : `${REGULAR_SESSION_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export function cookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // Задайте COOKIE_SECURE=true в .env.local, когато системата работи през HTTPS
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: maxAgeSec,
  };
}
