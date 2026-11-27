'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, signSession, verifySession, cookieOptions, nowSec, REGULAR_COOKIE_SECONDS } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';

const go = (k, m) => redirect(`/profil?${k}=${encodeURIComponent(m)}`);

export async function changePassword(formData) {
  const user = await requireUser();
  const current = String(formData.get('current') || '');
  const next = String(formData.get('next') || '');
  const confirm = String(formData.get('confirm') || '');
  const [row] = await query('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!(await bcrypt.compare(current, row.password_hash))) {
    await audit(user, 'password', 'profile', user.id, 'Неуспешна смяна на собствената парола – грешна текуща парола');
    go('error', 'Текущата парола е грешна.');
  }
  if (next.length < 6) go('error', 'Новата парола трябва да е поне 6 знака.');
  if (next !== confirm) go('error', 'Паролите не съвпадат.');
  await query('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [await bcrypt.hash(next, 10), user.id]);
  // сесиите на другите устройства спират; текущата получава нова бисквитка с новата версия
  const jar = await cookies();
  const cur = await verifySession(jar.get(SESSION_COOKIE)?.value);
  const sv = user.session_version + 1;
  const token = await signSession({ uid: user.id, la: nowSec(), sv, ...(cur?.to ? { to: true } : {}) });
  const maxAge = cur?.to ? Math.max(60, (cur.exp ?? nowSec() + 3600) - nowSec()) : REGULAR_COOKIE_SECONDS;
  jar.set(SESSION_COOKIE, token, cookieOptions(maxAge));
  await audit(user, 'password', 'profile', user.id, 'Смяна на собствената парола (сесиите на другите устройства са прекратени)');
  go('ok', 'Паролата е сменена.');
}
