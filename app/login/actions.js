'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { SESSION_COOKIE, signSession, cookieOptions, nowSec } from '@/lib/session';
import { getSettings, SERVER_GRACE_SECONDS } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function login(prevState, formData) {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'Въведете потребителско име и парола.', username };

  const rows = await query('SELECT id, username, full_name, password_hash, active FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await audit(user ? user : { username: username.slice(0, 60) }, 'login_failed', 'auth', user?.id,
      user ? 'Неуспешен вход – грешна парола' : `Неуспешен вход – несъществуващ потребител „${username.slice(0, 60)}“`);
    return { error: 'Грешно потребителско име или парола.', username };
  }
  if (!user.active) {
    await audit(user, 'login_failed', 'auth', user.id, 'Опит за вход с деактивиран профил');
    return { error: 'Профилът е деактивиран. Свържете се с администратор.', username };
  }

  const { session_timeout_minutes: minutes } = await getSettings();
  const token = await signSession({ uid: user.id, la: nowSec() });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(minutes * 60 + SERVER_GRACE_SECONDS));
  await audit(user, 'login', 'auth', user.id, 'Успешен вход в системата');
  redirect('/grafik');
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await audit(user, 'logout', 'auth', user.id, 'Изход от системата');
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

// Извиква се от браузъра, когато времето за неактивност изтече
export async function sessionExpired() {
  const user = await getCurrentUser();
  const [dup] = user
    ? await query("SELECT id FROM audit_log WHERE user_id = ? AND action = 'timeout' AND created_at > NOW() - INTERVAL 2 MINUTE LIMIT 1", [user.id])
    : [];
  if (user && !dup) {
    const { session_timeout_minutes: minutes } = await getSettings();
    await audit(user, 'timeout', 'auth', user.id, `Автоматичен изход поради неактивност (${minutes} мин)`);
  }
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
}
