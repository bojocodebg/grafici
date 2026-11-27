import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'puls_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

// Автоматичен изход при неактивност важи само за служебния акаунт с това потребителско име
export const TIMEOUT_USERNAME = 'admin';
// Обикновените потребители нямат ограничение във времето – остават влезли до „Изход“.
// Бисквитката е с максималния срок, който браузърите позволяват (400 дни), и се подновява
// автоматично при използване (веднъж на ден), така че на практика не изтича.
export const REGULAR_COOKIE_SECONDS = 400 * 24 * 60 * 60;

// payload: { uid, la, sv, to }
//   la = последна активност (сек. от 1970 г.), sv = версия на сесиите на потребителя,
//   to = важи автоматичният изход при неактивност (само admin)
export async function signSession(payload) {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  // admin: горна граница, реалното изтичане е по неактивност (la); останалите – без срок
  if (payload.to) jwt.setExpirationTime('2d');
  return jwt.sign(secret());
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
