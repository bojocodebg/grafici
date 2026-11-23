import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'puls_session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-me');

export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
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
