'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth';
import { query, pool } from '@/lib/db';
import { PERMISSION_KEYS, PERMISSIONS } from '@/lib/permissions';
import { audit, diff } from '@/lib/audit';

const FIELDS = {
  username: 'Потребителско име', full_name: 'Име', sort_order: 'Ред в графика', position: 'Длъжност', pharmacy: 'Аптека',
  phone: 'Телефон', email: 'Имейл', is_admin: 'Администратор', show_in_schedule: 'Участва в графиците', active: 'Активен', permissions: 'Права',
};

// Четим „човешки“ вид на потребителя за журнала (имена вместо id)
async function snapshot(u, perms) {
  if (!u) return {};
  const [pos] = u.position_id ? await query('SELECT name FROM positions WHERE id = ?', [u.position_id]) : [];
  const [ph] = u.pharmacy_id ? await query('SELECT name FROM pharmacies WHERE id = ?', [u.pharmacy_id]) : [];
  return {
    username: u.username, full_name: u.full_name, sort_order: u.sort_order, position: pos?.name, pharmacy: ph?.name,
    phone: u.phone, email: u.email, is_admin: u.is_admin ? 'да' : 'не', show_in_schedule: u.show_in_schedule ? 'да' : 'не', active: u.active ? 'да' : 'не',
    permissions: perms.map((p) => PERMISSIONS[p] || p).sort().join('; ') || null,
  };
}
// Потребител, който има смени в графиците, не може да бъде изтрит
async function userShiftCount(id) {
  const [{ c }] = await query('SELECT COUNT(*) c FROM shifts WHERE user_id = ?', [id]);
  return c;
}
const SCHEDULE_BLOCK_MSG = 'Потребителят не може да бъде изтрит, понеже присъства в графиците';

async function loadUser(id) {
  const [u] = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!u) return null;
  const perms = (await query('SELECT permission FROM user_permissions WHERE user_id = ?', [id])).map((r) => r.permission);
  return { u, perms };
}

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
    show_in_schedule: fd.get('show_in_schedule') ? 1 : 0,
    sort_order: Math.trunc(Number(fd.get('sort_order'))) || 0,
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
      'INSERT INTO users (username, password_hash, full_name, position_id, phone, email, pharmacy_id, is_admin, show_in_schedule, sort_order, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [f.username, await bcrypt.hash(f.password, 10), f.full_name, f.position_id, f.phone, f.email, f.pharmacy_id, f.is_admin, f.show_in_schedule, f.sort_order, f.active]
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
  await audit(me, 'create', 'user', id, `Създаден потребител „${f.full_name}“ (${f.username})`, diff({}, await snapshot(f, f.permissions), FIELDS));
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

  const before = await loadUser(id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE users SET username=?, full_name=?, position_id=?, phone=?, email=?, pharmacy_id=?, is_admin=?, show_in_schedule=?, sort_order=?, active=? WHERE id=?',
      [f.username, f.full_name, f.position_id, f.phone, f.email, f.pharmacy_id, f.is_admin, f.show_in_schedule, f.sort_order, f.active, id]
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
  const changes = diff(await snapshot(before.u, before.perms), await snapshot(f, f.permissions), FIELDS);
  if (f.password) changes['Парола'] = ['••••••', 'сменена от администратор'];
  if (Object.keys(changes).length) await audit(me, 'update', 'user', id, `Редактиран потребител „${f.full_name}“ (${f.username})`, changes);
  revalidatePath('/admin/potrebiteli');
  go(path, 'ok', 'Промените са записани.');
}

export async function deleteUser(id) {
  const me = await requirePermission('users.manage');
  if (id === me.id) go(`/admin/potrebiteli/${id}`, 'error', 'Не можете да изтриете собствения си профил.');
  const [target] = await query('SELECT is_admin FROM users WHERE id = ?', [id]);
  if (target?.is_admin && !me.is_admin) go(`/admin/potrebiteli/${id}`, 'error', 'Само администратор може да изтрие администратор.');
  if (await userShiftCount(id)) go(`/admin/potrebiteli/${id}`, 'error', SCHEDULE_BLOCK_MSG);
  const before = await loadUser(id);
  await query('DELETE FROM users WHERE id = ?', [id]);
  if (before) await audit(me, 'delete', 'user', id, `Изтрит потребител „${before.u.full_name}“ (${before.u.username}) заедно със смените, забележките и отпуските му`,
    diff(await snapshot(before.u, before.perms), {}, FIELDS));
  revalidatePath('/admin/potrebiteli');
  go('/admin/potrebiteli', 'ok', 'Потребителят е изтрит.');
}

// Запазва реда в графика за много потребители наведнъж (от списъка с потребители)
export async function saveOrder(formData) {
  const me = await requirePermission('users.manage');
  const rows = await query('SELECT id, full_name, sort_order FROM users');
  const changes = {};
  for (const u of rows) {
    const raw = formData.get(`order_${u.id}`);
    if (raw === null || raw === '') continue;
    const v = Math.trunc(Number(raw));
    if (!Number.isFinite(v) || v === u.sort_order) continue;
    await query('UPDATE users SET sort_order = ? WHERE id = ?', [v, u.id]);
    changes[u.full_name] = [String(u.sort_order), String(v)];
  }
  const n = Object.keys(changes).length;
  if (n) await audit(me, 'update', 'user', null, `Променена подредба в графика (${n} потребител${n === 1 ? '' : 'я'})`, changes);
  revalidatePath('/admin/potrebiteli');
  revalidatePath('/grafik');
  go('/admin/potrebiteli', 'ok', n ? `Подредбата е запазена (${n} ${n === 1 ? 'промяна' : 'промени'}).` : 'Няма промени в подредбата.');
}
