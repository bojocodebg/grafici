'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth';
import { query, pool } from '@/lib/db';
import { PERMISSION_KEYS } from '@/lib/permissions';

const go = (path, k, msg) => redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}`);

function readForm(fd) {
  return {
    username: String(fd.get('username') || '').trim(),
    full_name: String(fd.get('full_name') || '').trim(),
    position_id: Number(fd.get('position_id')) || null,
    phone: String(fd.get('phone') || '').trim() || null,
    email: String(fd.get('email') || '').trim() || null,
    pharmacy_id: Number(fd.get('pharmacy_id')) || null,
    active: fd.get('active') ? 1 : 0,
    is_admin: fd.get('is_admin') ? 1 : 0,
    password: String(fd.get('password') || ''),
    permissions: fd.getAll('permissions').map(String).filter((p) => PERMISSION_KEYS.includes(p)),
  };
}

async function savePermissions(conn, userId, perms) {
  await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
  if (perms.length) await conn.query('INSERT INTO user_permissions (user_id, permission) VALUES ?', [perms.map((p) => [userId, p])]);
}

export async function createUser(formData) {
  const me = await requirePermission('users.manage');
  const f = readForm(formData);
  const path = '/admin/potrebiteli/nov';
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(f.username)) go(path, 'error', 'Потребителското име трябва да е 3–60 латински букви/цифри (. _ -).');
  if (!f.full_name) go(path, 'error', 'Въведете име.');
  if (f.password.length < 6) go(path, 'error', 'Паролата трябва да е поне 6 знака.');
  if (f.is_admin && !me.is_admin) go(path, 'error', 'Само администратор може да създава администратори.');
  const exists = await query('SELECT id FROM users WHERE username = ?', [f.username]);
  if (exists.length) go(path, 'error', 'Потребителското име е заето.');

  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [res] = await conn.query(
      'INSERT INTO users (username, password_hash, full_name, position_id, phone, email, pharmacy_id, is_admin, active) VALUES (?,?,?,?,?,?,?,?,?)',
      [f.username, await bcrypt.hash(f.password, 10), f.full_name, f.position_id, f.phone, f.email, f.pharmacy_id, f.is_admin, f.active]
    );
    id = res.insertId;
    await savePermissions(conn, id, f.permissions);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  revalidatePath('/admin/potrebiteli');
  go('/admin/potrebiteli', 'ok', `Потребителят „${f.full_name}“ е създаден.`);
}

export async function updateUser(id, formData) {
  const me = await requirePermission('users.manage');
  const f = readForm(formData);
  const path = `/admin/potrebiteli/${id}`;
  const [target] = await query('SELECT id, is_admin FROM users WHERE id = ?', [id]);
  if (!target) go('/admin/potrebiteli', 'error', 'Потребителят не съществува.');
  if (!f.full_name) go(path, 'error', 'Въведете име.');
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(f.username)) go(path, 'error', 'Невалидно потребителско име.');
  if (!me.is_admin && (target.is_admin || f.is_admin)) go(path, 'error', 'Само администратор може да променя администратори.');
  if (id === me.id && (!f.active || (me.is_admin && !f.is_admin))) go(path, 'error', 'Не можете да деактивирате или да премахнете собствените си администраторски права.');
  if (id === me.id && !me.is_admin && !f.permissions.includes('users.manage')) go(path, 'error', 'Не можете да премахнете собственото си право за управление на потребители.');
  if (f.password && f.password.length < 6) go(path, 'error', 'Паролата трябва да е поне 6 знака.');
  const dup = await query('SELECT id FROM users WHERE username = ? AND id <> ?', [f.username, id]);
  if (dup.length) go(path, 'error', 'Потребителското име е заето.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE users SET username=?, full_name=?, position_id=?, phone=?, email=?, pharmacy_id=?, is_admin=?, active=? WHERE id=?',
      [f.username, f.full_name, f.position_id, f.phone, f.email, f.pharmacy_id, f.is_admin, f.active, id]
    );
    if (f.password) await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(f.password, 10), id]);
    await savePermissions(conn, id, f.permissions);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  revalidatePath('/admin/potrebiteli');
  go(path, 'ok', 'Промените са записани.');
}

export async function deleteUser(id) {
  const me = await requirePermission('users.manage');
  if (id === me.id) go(`/admin/potrebiteli/${id}`, 'error', 'Не можете да изтриете собствения си профил.');
  const [target] = await query('SELECT is_admin FROM users WHERE id = ?', [id]);
  if (target?.is_admin && !me.is_admin) go(`/admin/potrebiteli/${id}`, 'error', 'Само администратор може да изтрие администратор.');
  await query('DELETE FROM users WHERE id = ?', [id]);
  revalidatePath('/admin/potrebiteli');
  go('/admin/potrebiteli', 'ok', 'Потребителят е изтрит.');
}
