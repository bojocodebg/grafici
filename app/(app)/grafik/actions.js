'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { monthDays, fmtDate, MONTHS } from '@/lib/dates';
import { audit } from '@/lib/audit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function nameOf(table, id, col = 'name') {
  const [r] = await query(`SELECT ${col} n FROM ${table} WHERE id = ?`, [id]);
  return r?.n ?? `#${id}`;
}

// Само потребители с право "schedule.edit" могат да променят графика.
export async function setShift({ userId, date, shiftTypeId, pharmacyId }) {
  const editor = await requirePermission('schedule.edit');
  if (!DATE_RE.test(date)) throw new Error('Невалидна дата');
  const [old] = await query(
    `SELECT s.id, s.shift_type_id, s.pharmacy_id, st.code, st.name FROM shifts s JOIN shift_types st ON st.id = s.shift_type_id
      WHERE s.user_id = ? AND s.work_date = ?`,
    [userId, date]
  );
  const worker = await nameOf('users', userId, 'full_name');
  if (shiftTypeId) {
    const [target] = await query('SELECT active, show_in_schedule FROM users WHERE id = ?', [userId]);
    if (!target?.active || !target.show_in_schedule) return { error: 'Този потребител не участва в графиците.' };
  }

  if (!shiftTypeId) {
    // Изтриване е позволено винаги (вкл. ден с отпуск – за почистване на стари записи)
    if (!old) return { ok: true };
    await query('DELETE FROM shifts WHERE user_id = ? AND work_date = ?', [userId, date]);
    await audit(editor, 'delete', 'shift', old.id, `${worker}, ${fmtDate(date)}: изтрита смяна ${old.code} (${old.name})`);
  } else {
    const leave = await query(
      "SELECT id FROM leave_requests WHERE user_id = ? AND status = 'approved' AND ? BETWEEN date_from AND date_to LIMIT 1",
      [userId, date]
    );
    if (leave.length) return { error: 'Служителят е в одобрен отпуск на тази дата – не може да се добавя смяна.' };
    const [type] = await query('SELECT code, name FROM shift_types WHERE id = ?', [shiftTypeId]);
    if (!type) return { error: 'Невалиден тип смяна.' };
    if (old && old.shift_type_id === Number(shiftTypeId) && old.pharmacy_id === Number(pharmacyId)) return { ok: true };
    const res = await query(
      `INSERT INTO shifts (user_id, pharmacy_id, work_date, shift_type_id, created_by)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE shift_type_id = VALUES(shift_type_id), pharmacy_id = VALUES(pharmacy_id), created_by = VALUES(created_by)`,
      [userId, pharmacyId, date, shiftTypeId, editor.id]
    );
    const pharmacy = await nameOf('pharmacies', pharmacyId);
    if (old) {
      const changes = {};
      if (old.shift_type_id !== Number(shiftTypeId)) changes['Смяна'] = [`${old.code} – ${old.name}`, `${type.code} – ${type.name}`];
      if (old.pharmacy_id !== Number(pharmacyId)) changes['Аптека'] = [await nameOf('pharmacies', old.pharmacy_id), pharmacy];
      const moved = old.pharmacy_id !== Number(pharmacyId) ? ` – преместена от ${changes['Аптека'][0]}` : '';
      await audit(editor, 'update', 'shift', old.id, `${worker}, ${fmtDate(date)}: смяна ${old.code} → ${type.code} (${pharmacy})${moved}`, changes);
    } else {
      await audit(editor, 'create', 'shift', res.insertId, `${worker}, ${fmtDate(date)}: добавена смяна ${type.code} (${type.name}), ${pharmacy}`);
    }
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
       JOIN users u ON u.id = s.user_id AND u.active = 1 AND u.show_in_schedule = 1
      WHERE s.pharmacy_id = ? AND s.work_date BETWEEN ? AND ?`,
    [pharmacyId, prevDays[0].date, prevDays.at(-1).date]
  );
  let n = 0;
  for (const r of rows) {
    const day = days[r.d - 1];
    if (!day) continue;
    // не се копират смени в дни с одобрен отпуск
    const res = await query(
      `INSERT IGNORE INTO shifts (user_id, pharmacy_id, work_date, shift_type_id, created_by)
       SELECT ?,?,?,?,? FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM leave_requests WHERE user_id = ? AND status = 'approved' AND ? BETWEEN date_from AND date_to)`,
      [r.user_id, pharmacyId, day.date, r.shift_type_id, editor.id, r.user_id, day.date]
    );
    n += res.affectedRows;
  }
  const pharmacy = await nameOf('pharmacies', pharmacyId);
  await audit(editor, 'copy', 'schedule', pharmacyId,
    `${pharmacy}: копиран график от ${MONTHS[pm - 1].toLowerCase()} ${py} към ${MONTHS[month - 1].toLowerCase()} ${year} – ${n} смени`);
  revalidatePath('/grafik');
  return { copied: n };
}

export async function clearMonth({ pharmacyId, year, month, confirmText }) {
  const editor = await requirePermission('schedule.edit');
  // допълнителна защита: изисква се написано DELETE (главни букви)
  if (confirmText !== 'DELETE') return { error: 'За изчистване на месеца трябва да напишете DELETE с главни букви.' };
  const days = monthDays(year, month);
  const res = await query('DELETE FROM shifts WHERE pharmacy_id = ? AND work_date BETWEEN ? AND ?', [pharmacyId, days[0].date, days.at(-1).date]);
  const pharmacy = await nameOf('pharmacies', pharmacyId);
  await audit(editor, 'clear', 'schedule', pharmacyId,
    `${pharmacy}: изчистен график за ${MONTHS[month - 1].toLowerCase()} ${year} – изтрити ${res.affectedRows} смени`);
  revalidatePath('/grafik');
  return { ok: true };
}
