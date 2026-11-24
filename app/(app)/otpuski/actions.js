'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { daysBetween, fmtDate } from '@/lib/dates';
import { audit } from '@/lib/audit';

const back = (k, msg) => redirect(`/otpuski?${k}=${encodeURIComponent(msg)}`);
const TYPES = ['paid', 'unpaid', 'sick', 'other'];
const TYPE_LABEL = { paid: 'платен', unpaid: 'неплатен', sick: 'болничен', other: 'друг' };
const STATUS_LABEL = { pending: 'Чака одобрение', approved: 'Одобрена', rejected: 'Отказана' };

async function loadLeave(id) {
  const [l] = await query('SELECT l.*, u.full_name FROM leave_requests l JOIN users u ON u.id = l.user_id WHERE l.id = ?', [id]);
  return l;
}
const describe = (l) => `${l.full_name}, ${TYPE_LABEL[l.leave_type]} отпуск ${fmtDate(l.date_from)} – ${fmtDate(l.date_to)} (${l.days} дни)`;

// Всеки потребител може да подаде заявка. След подаване служителят НЕ може да я променя.
export async function addLeave(formData) {
  const user = await requireUser();
  const type = String(formData.get('leave_type'));
  const from = String(formData.get('date_from') || '');
  const to = String(formData.get('date_to') || '');
  const reason = String(formData.get('reason') || '').trim().slice(0, 2000);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!TYPES.includes(type)) back('error', 'Невалиден вид отпуск.');
  if (!re.test(from) || !re.test(to)) back('error', 'Въведете начална и крайна дата.');
  if (to < from) back('error', 'Крайната дата е преди началната.');
  const days = daysBetween(from, to);
  if (days > 365) back('error', 'Периодът е твърде дълъг.');
  const overlap = await query(
    "SELECT id FROM leave_requests WHERE user_id = ? AND status <> 'rejected' AND date_from <= ? AND date_to >= ?",
    [user.id, to, from]
  );
  if (overlap.length) back('error', 'Вече имате заявка, която се застъпва с този период.');
  const res = await query('INSERT INTO leave_requests (user_id, leave_type, date_from, date_to, days, reason) VALUES (?,?,?,?,?,?)', [
    user.id, type, from, to, days, reason || null,
  ]);
  await audit(user, 'create', 'leave', res.insertId,
    `Заявка за отпуск: ${describe({ full_name: user.full_name, leave_type: type, date_from: from, date_to: to, days })}`,
    reason ? { 'Причина': [null, reason] } : null);
  revalidatePath('/otpuski');
  back('ok', 'Заявката е подадена и очаква одобрение.');
}

// Смени, записани в графика на служителя в периода на отпуска
async function leaveConflicts(leaveId) {
  return query(
    `SELECT s.work_date, st.code, st.name FROM leave_requests l
       JOIN shifts s ON s.user_id = l.user_id AND s.work_date BETWEEN l.date_from AND l.date_to
       JOIN shift_types st ON st.id = s.shift_type_id
      WHERE l.id = ? ORDER BY s.work_date`,
    [leaveId]
  );
}

export async function reviewLeave(id, status, formData) {
  const admin = await requirePermission('leave.approve');
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('Невалиден статус');
  const old = await loadLeave(id);
  if (!old) back('error', 'Заявката не съществува.');
  if (status === 'approved') {
    const conflicts = await leaveConflicts(id);
    if (conflicts.length) {
      const list = conflicts.map((c) => `${c.work_date.slice(8)}.${c.work_date.slice(5, 7)} (${c.code})`).join(', ');
      back('error', `Отпускът не може да бъде одобрен – в периода има записани смени: ${list}. Първо ги изтрийте от графика.`);
    }
  }
  const comment = String(formData?.get?.('comment') || '').trim();
  await query(
    'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_comment = ? WHERE id = ?',
    [status, status === 'pending' ? null : admin.id, comment || null, id]
  );
  const action = { approved: 'approve', rejected: 'reject', pending: 'reopen' }[status];
  const changes = { 'Статус': [STATUS_LABEL[old.status], STATUS_LABEL[status]] };
  if (comment) changes['Коментар'] = [old.review_comment, comment];
  await audit(admin, action, 'leave', id, `${{ approve: 'Одобрен', reject: 'Отказан', reopen: 'Върнат за преглед' }[action]} отпуск: ${describe(old)}`, changes);
  revalidatePath('/otpuski');
  revalidatePath('/grafik');
}

export async function deleteLeave(id) {
  const admin = await requirePermission('leave.approve');
  const old = await loadLeave(id);
  if (!old) return;
  await query('DELETE FROM leave_requests WHERE id = ?', [id]);
  await audit(admin, 'delete', 'leave', id, `Изтрита заявка за отпуск (${STATUS_LABEL[old.status].toLowerCase()}): ${describe(old)}`);
  revalidatePath('/otpuski');
  revalidatePath('/grafik');
}
