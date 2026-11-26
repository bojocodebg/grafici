import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'puls_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

// payload: { uid, la } – la = последна активност (секунди от 1970 г.)
export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2d') // горна граница; реалното изтичане е по неактивност (la)
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
