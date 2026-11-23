'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';

const read = (fd) => ({
  name: String(fd.get('name') || '').trim(),
  address: String(fd.get('address') || '').trim() || null,
  phone: String(fd.get('phone') || '').trim() || null,
  active: fd.get('active') ? 1 : 0,
});

export async function createPharmacy(formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) return;
  await query('INSERT INTO pharmacies (name, address, phone, active) VALUES (?,?,?,1)', [f.name, f.address, f.phone]);
  revalidatePath('/admin/apteki');
}

export async function updatePharmacy(id, formData) {
  await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) return;
  await query('UPDATE pharmacies SET name=?, address=?, phone=?, active=? WHERE id=?', [f.name, f.address, f.phone, f.active, id]);
  revalidatePath('/admin/apteki');
}
