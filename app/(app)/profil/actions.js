'use server';
import { redirect } from 'next/navigation';
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
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 10), user.id]);
  await audit(user, 'password', 'profile', user.id, 'Смяна на собствената парола');
  go('ok', 'Паролата е сменена.');
}
