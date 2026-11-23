'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { monthDays } from '@/lib/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Само потребители с право "schedule.edit" могат да променят графика.
export async function setShift({ userId, date, shiftTypeId, pharmacyId }) {
  const editor = await requirePermission('schedule.edit');
  if (!DATE_RE.test(date)) throw new Error('Невалидна дата');
  if (!shiftTypeId) {
    await query('DELETE FROM shifts WHERE user_id = ? AND work_date = ?', [userId, date]);
  } else {
    await query(
      `INSERT INTO shifts (user_id, pharmacy_id, work_date, shift_type_id, created_by)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE shift_type_id = VALUES(shift_type_id), pharmacy_id = VALUES(pharmacy_id), created_by = VALUES(created_by)`,
      [userId, pharmacyId, date, shiftTypeId, editor.id]
    );
  }
  revalidatePath('/grafik');
  return { ok: true };
}

// Копира графика на аптеката от предходния месец (по ден от месеца), без да презаписва вече въведени смени.
export async function copyPreviousMonth({ pharmacyId, year, month }) {
  const editor = await requirePermission('schedule.edit');
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const py = prev.getUTCFullYear(), pm = prev.getUTCMonth() + 1;
  const prevDays = monthDays(py, pm);
  const days = monthDays(year, month);
  const rows = await query(
    `SELECT s.user_id, DAY(s.work_date) d, s.shift_type_id FROM shifts s
       JOIN users u ON u.id = s.user_id AND u.active = 1 AND u.pharmacy_id = ?
      WHERE s.pharmacy_id = ? AND s.work_date BETWEEN ? AND ?`,
    [pharmacyId, pharmacyId, prevDays[0].date, prevDays.at(-1).date]
  );
  let n = 0;
  for (const r of rows) {
    const day = days[r.d - 1];
    if (!day) continue;
    const res = await query(
      'INSERT IGNORE INTO shifts (user_id, pharmacy_id, work_date, shift_type_id, created_by) VALUES (?,?,?,?,?)',
      [r.user_id, pharmacyId, day.date, r.shift_type_id, editor.id]
    );
    n += res.affectedRows;
  }
  revalidatePath('/grafik');
  return { copied: n };
}

export async function clearMonth({ pharmacyId, year, month }) {
  await requirePermission('schedule.edit');
  const days = monthDays(year, month);
  await query('DELETE FROM shifts WHERE pharmacy_id = ? AND work_date BETWEEN ? AND ?', [pharmacyId, days[0].date, days.at(-1).date]);
  revalidatePath('/grafik');
  return { ok: true };
}
