'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';

const PATH = '/admin/dlazhnosti';
const go = (k, msg) => redirect(`${PATH}?${k}=${encodeURIComponent(msg)}`);

const read = (fd) => ({
  name: String(fd.get('name') || '').trim().slice(0, 100),
  sort_order: Number(fd.get('sort_order')) || 0,
  active: fd.get('active') ? 1 : 0,
});

async function nameTaken(name, exceptId = 0) {
  const r = await query('SELECT id FROM positions WHERE name = ? AND id <> ?', [name, exceptId]);
  return r.length > 0;
}

export async function createPosition(formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) go('error', 'Въведете наименование.');
  if (await nameTaken(f.name)) go('error', `Длъжност „${f.name}“ вече съществува.`);
  await query('INSERT INTO positions (name, sort_order, active) VALUES (?,?,1)', [f.name, f.sort_order]);
  revalidatePath(PATH);
  go('ok', `Длъжността „${f.name}“ е добавена.`);
}

export async function updatePosition(id, formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) go('error', 'Въведете наименование.');
  if (await nameTaken(f.name, id)) go('error', `Длъжност „${f.name}“ вече съществува.`);
  await query('UPDATE positions SET name = ?, sort_order = ?, active = ? WHERE id = ?', [f.name, f.sort_order, f.active, id]);
  revalidatePath(PATH);
  go('ok', 'Промените са записани.');
}

export async function deletePosition(id) {
  await requirePermission('pharmacies.manage');
  const [{ c }] = await query('SELECT COUNT(*) c FROM users WHERE position_id = ?', [id]);
  if (c > 0) go('error', `Длъжността не може да бъде изтрита – използва се от ${c} потребител(и). Можете да я деактивирате.`);
  await query('DELETE FROM positions WHERE id = ?', [id]);
  revalidatePath(PATH);
  go('ok', 'Длъжността е изтрита.');
}
