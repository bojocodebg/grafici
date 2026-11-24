'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { audit, diff } from '@/lib/audit';

const FIELDS = { sort_order: 'Ред', code: 'Код', name: 'Наименование', start_time: 'От', end_time: 'До', hours: 'Часове', color: 'Цвят', active: 'Активен' };
const t5 = (v) => (v ? String(v).slice(0, 5) : v);
const cmp = (r) => r && ({ ...r, start_time: t5(r.start_time), end_time: t5(r.end_time), hours: r.hours != null ? Number(r.hours) : r.hours });

const read = (fd) => ({
  code: String(fd.get('code') || '').trim().slice(0, 5),
  name: String(fd.get('name') || '').trim(),
  start_time: String(fd.get('start_time') || '') || null,
  end_time: String(fd.get('end_time') || '') || null,
  hours: Math.max(0, Math.min(24, Number(String(fd.get('hours') || '0').replace(',', '.')) || 0)),
  sort_order: Math.trunc(Number(fd.get('sort_order'))) || 0,
  color: /^#[0-9a-fA-F]{6}$/.test(String(fd.get('color'))) ? String(fd.get('color')) : '#4caf50',
  active: fd.get('active') ? 1 : 0,
});

export async function createShiftType(formData) {
  const user = await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.code || !f.name) return;
  const res = await query('INSERT INTO shift_types (code, name, start_time, end_time, hours, color, sort_order, active) VALUES (?,?,?,?,?,?,?,1)',
    [f.code, f.name, f.start_time, f.end_time, f.hours, f.color, f.sort_order]);
  await audit(user, 'create', 'shift_type', res.insertId, `Добавен тип смяна ${f.code} – ${f.name}`, diff({}, cmp({ ...f, active: 1 }), FIELDS));
  revalidatePath('/admin/smeni');
  revalidatePath('/grafik');
}

export async function updateShiftType(id, formData) {
  const user = await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.code || !f.name) return;
  const [old] = await query('SELECT * FROM shift_types WHERE id = ?', [id]);
  const changes = diff(cmp(old), cmp(f), FIELDS);
  if (Object.keys(changes).length) await audit(user, 'update', 'shift_type', id, `Редактиран тип смяна ${f.code} – ${f.name}`, changes);
  await query('UPDATE shift_types SET code=?, name=?, start_time=?, end_time=?, hours=?, color=?, sort_order=?, active=? WHERE id=?',
    [f.code, f.name, f.start_time, f.end_time, f.hours, f.color, f.sort_order, f.active, id]);
  revalidatePath('/admin/smeni');
  revalidatePath('/grafik');
}
