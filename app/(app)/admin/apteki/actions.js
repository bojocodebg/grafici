'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { audit, diff } from '@/lib/audit';

const FIELDS = { name: 'Име', address: 'Адрес', phone: 'Телефон', active: 'Активна' };

const read = (fd) => ({
  name: String(fd.get('name') || '').trim(),
  address: String(fd.get('address') || '').trim() || null,
  phone: String(fd.get('phone') || '').trim() || null,
  active: fd.get('active') ? 1 : 0,
});

export async function createPharmacy(formData) {
  const user = await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) return;
  const res = await query('INSERT INTO pharmacies (name, address, phone, active) VALUES (?,?,?,1)', [f.name, f.address, f.phone]);
  await audit(user, 'create', 'pharmacy', res.insertId, `Добавена аптека „${f.name}“`, diff({}, { ...f, active: 1 }, FIELDS));
  revalidatePath('/admin/apteki');
}

export async function updatePharmacy(id, formData) {
  const user = await requirePermission('pharmacies.manage');
  const f = read(formData);
  if (!f.name) return;
  const [old] = await query('SELECT * FROM pharmacies WHERE id = ?', [id]);
  const changes = diff(old, f, FIELDS);
  if (Object.keys(changes).length) await audit(user, 'update', 'pharmacy', id, `Редактирана аптека „${f.name}“`, changes);
  await query('UPDATE pharmacies SET name=?, address=?, phone=?, active=? WHERE id=?', [f.name, f.address, f.phone, f.active, id]);
  revalidatePath('/admin/apteki');
}
