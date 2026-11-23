'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { daysBetween } from '@/lib/dates';

const back = (k, msg) => redirect(`/otpuski?${k}=${encodeURIComponent(msg)}`);
const TYPES = ['paid', 'unpaid', 'sick', 'other'];

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
  await query('INSERT INTO leave_requests (user_id, leave_type, date_from, date_to, days, reason) VALUES (?,?,?,?,?,?)', [
    user.id, type, from, to, days, reason || null,
  ]);
  revalidatePath('/otpuski');
  back('ok', 'Заявката е подадена и очаква одобрение.');
}

export async function reviewLeave(id, status, formData) {
  const admin = await requirePermission('leave.approve');
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error('Невалиден статус');
  const comment = String(formData?.get?.('comment') || '').trim();
  await query(
    'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_comment = ? WHERE id = ?',
    [status, status === 'pending' ? null : admin.id, comment || null, id]
  );
  revalidatePath('/otpuski');
  revalidatePath('/grafik');
}

export async function deleteLeave(id) {
  await requirePermission('leave.approve');
  await query('DELETE FROM leave_requests WHERE id = ?', [id]);
  revalidatePath('/otpuski');
  revalidatePath('/grafik');
}
