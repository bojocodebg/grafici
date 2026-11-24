import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { query } from './db';
import { SESSION_COOKIE, verifySession } from './session';
import { can, PERMISSION_KEYS } from './permissions';

// Потребителят се зарежда от базата при всяка заявка, така че промени в правата
// и деактивиране влизат в сила веднага.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session?.uid) return null;
  const rows = await query(
    `SELECT u.id, u.username, u.full_name, pos.name AS position, u.pharmacy_id, u.is_admin, p.name AS pharmacy_name
       FROM users u LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
       LEFT JOIN positions pos ON pos.id = u.position_id
      WHERE u.id = ? AND u.active = 1`,
    [session.uid]
  );
  const user = rows[0];
  if (!user) return null;
  user.is_admin = !!user.is_admin;
  if (user.is_admin) user.permissions = [...PERMISSION_KEYS];
  else {
    const perms = await query('SELECT permission FROM user_permissions WHERE user_id = ?', [user.id]);
    user.permissions = perms.map((p) => p.permission);
  }
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requirePermission(perm) {
  const user = await requireUser();
  if (!can(user, perm)) redirect('/nedostap');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.is_admin) redirect('/nedostap');
  return user;
}

export { can };
