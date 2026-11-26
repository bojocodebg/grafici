import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession, signSession, cookieOptions, nowSec } from './lib/session';
import { getSettings, SERVER_GRACE_SECONDS } from './lib/settings';
import { query } from './lib/db';

// Записва в журнала изход поради неактивност, открит от сървъра (напр. затворен браузър)
async function logTimeout(uid, req, minutes) {
  try {
    const [u] = await query('SELECT id, username, full_name FROM users WHERE id = ?', [uid]);
    if (!u) return;
    // без повторни записи (няколко едновременни заявки / раздела)
    const [dup] = await query("SELECT id FROM audit_log WHERE user_id = ? AND action = 'timeout' AND created_at > NOW() - INTERVAL 2 MINUTE LIMIT 1", [uid]);
    if (dup) return;
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
    await query(
      `INSERT INTO audit_log (user_id, username, full_name, action, entity, entity_id, summary, ip, user_agent)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [u.id, u.username, u.full_name, 'timeout', 'auth', u.id,
        `Сесията изтече поради неактивност (${minutes} мин)`, ip, (req.headers.get('user-agent') || '').slice(0, 255) || null]
    );
  } catch (e) {
    console.error('Грешка при запис в журнала:', e.message);
  }
}

// Next.js 16: "proxy" замества "middleware".
// - пренасочва неудостоверени потребители към /login
// - автоматичен изход след неактивност (настройва се от администратора)
// - „плъзгаща“ сесия: при активност бисквитката се подновява (най-много веднъж в минута)
export async function proxy(req) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { session_timeout_minutes: minutes } = await getSettings();
  const limit = minutes * 60 + SERVER_GRACE_SECONDS;
  const now = nowSec();
  const last = Number(session?.la ?? session?.iat ?? 0);
  const expired = !!session && now - last > limit;

  if (pathname.startsWith('/login')) {
    if (session && !expired) return NextResponse.redirect(new URL('/grafik', req.url));
    const res = NextResponse.next();
    if (expired) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!session || expired) {
    if (expired) await logTimeout(session.uid, req, minutes);
    const res = isApi
      ? NextResponse.json({ error: expired ? 'expired' : 'unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(expired ? '/login?expired=1' : '/login', req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const res = NextResponse.next();
  if (now - last >= 60 || pathname === '/api/session/ping') {
    res.cookies.set(SESSION_COOKIE, await signSession({ uid: session.uid, la: now }), cookieOptions(limit));
  }
  return res;
}

export const config = { matcher: ['/((?!_next/|favicon.ico|.*\\.(?:png|svg|ico|jpg)$).*)'] };
