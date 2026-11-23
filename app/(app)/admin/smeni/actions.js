'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';

const read = (fd) => ({
  code: String(fd.get('code') || '').trim().slice(0, 5),
  name: String(fd.get('name') || '').trim(),
  start_time: String(fd.get('start_time') || '') || null,
  end_time: String(fd.get('end_time') || '') || null,
  hours: Math.max(0, Math.min(24, Number(String(fd.get('hours') || '0').replace(',', '.')) || 0)),
  color: /^#[0-9a-fA-F]{6}$/.test(String(fd.get('color'))) ? String(fd.get('color')) : '#4caf50',
  active: fd.get('active') ? 1 : 0,
});

export async function createShiftType(formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.code || !f.name) return;
  await query('INSERT INTO shift_types (code, name, start_time, end_time, hours, color, active) VALUES (?,?,?,?,?,?,1)',
    [f.code, f.name, f.start_time, f.end_time, f.hours, f.color]);
  revalidatePath('/admin/smeni');
  revalidatePath('/grafik');
}

export async function updateShiftType(id, formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.code || !f.name) return;
  await query('UPDATE shift_types SET code=?, name=?, start_time=?, end_time=?, hours=?, color=?, active=? WHERE id=?',
    [f.code, f.name, f.start_time, f.end_time, f.hours, f.color, f.active, id]);
  revalidatePath('/admin/smeni');
  revalidatePath('/grafik');
}
