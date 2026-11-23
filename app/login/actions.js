'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { SESSION_COOKIE, signSession } from '@/lib/session';

export async function login(prevState, formData) {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'Въведете потребителско име и парола.', username };

  const rows = await query('SELECT id, password_hash, active FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: 'Грешно потребителско име или парола.', username };
  }
  if (!user.active) return { error: 'Профилът е деактивиран. Свържете се с администратор.', username };

  const token = await signSession({ uid: user.id });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Задайте COOKIE_SECURE=true в .env.local, когато системата работи през HTTPS
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  redirect('/grafik');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
