'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, requirePermission, requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtDate } from '@/lib/dates';
import { audit, diff } from '@/lib/audit';

// Приема гггг-мм-дд или дд.мм.гггг; връща гггг-мм-дд или null при невалидна дата
function parseDate(v) {
  let s = String(v || '').trim();
  const bg = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (bg) s = `${bg[3]}-${bg[2]}-${bg[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s ? s : null;
}
const back = (k, msg) => redirect('/zabelezhki?' + k + '=' + encodeURIComponent(msg));
const refresh = () => { revalidatePath('/zabelezhki'); revalidatePath('/grafik'); };
const short = (t, n = 80) => (t && t.length > n ? t.slice(0, n) + '…' : t || '');

async function loadNote(id) {
  const [n] = await query('SELECT n.*, u.full_name author FROM notes n JOIN users u ON u.id = n.user_id WHERE n.id = ?', [id]);
  return n;
}

// Всеки потребител може да добави забележка. Всички забележки се виждат от всички,
// но редакция и изтриване може да прави само администратор.
export async function addNote(formData) {
  const user = await requireUser();
  const content = String(formData.get('content') || '').trim();
  const date = parseDate(formData.get('work_date'));
  if (!date) back('error', 'Изберете дата, за която се отнася забележката (дд.мм.гггг).');
  if (!content) back('error', 'Въведете текст на забележката.');
  if (content.length > 2000) back('error', 'Текстът е твърде дълъг (макс. 2000 знака).');
  const res = await query('INSERT INTO notes (user_id, work_date, content) VALUES (?,?,?)', [user.id, date, content]);
  await audit(user, 'create', 'note', res.insertId, `Забележка за ${fmtDate(date)}: „${short(content)}“`);
  refresh();
  back('ok', 'Забележката е изпратена.');
}

export async function editNote(id, formData) {
  const admin = await requireAdmin();
  const content = String(formData.get('content') || '').trim().slice(0, 2000);
  const date = parseDate(formData.get('work_date'));
  if (!date) back('error', 'Изберете валидна дата (дд.мм.гггг).');
  if (!content) back('error', 'Текстът на забележката не може да е празен.');
  const old = await loadNote(id);
  if (!old) back('error', 'Забележката не съществува.');
  await query('UPDATE notes SET content = ?, work_date = ? WHERE id = ?', [content, date, id]);
  const changes = diff(old, { content, work_date: date }, { work_date: 'Дата', content: 'Текст' });
  await audit(admin, 'update', 'note', id, `Редактирана забележка на ${old.author} за ${fmtDate(date)}`, changes);
  refresh();
  back('ok', 'Забележката е редактирана.');
}

export async function deleteNote(id) {
  const admin = await requireAdmin();
  const old = await loadNote(id);
  if (!old) return;
  await query('DELETE FROM notes WHERE id = ?', [id]);
  await audit(admin, 'delete', 'note', id, `Изтрита забележка на ${old.author} за ${fmtDate(old.work_date)}: „${short(old.content)}“`,
    { 'Текст': [old.content, null], ...(old.reply ? { 'Отговор': [old.reply, null] } : {}) });
  refresh();
}

export async function replyNote(id, formData) {
  const user = await requirePermission('notes.manage');
  const reply = String(formData.get('reply') || '').trim();
  const old = await loadNote(id);
  if (!old) return;
  await query("UPDATE notes SET reply = ?, replied_by = ?, replied_at = NOW(), status = 'seen' WHERE id = ?", [reply || null, user.id, id]);
  await audit(user, 'reply', 'note', id, `Отговор на забележка на ${old.author} (${fmtDate(old.work_date)}): „${short(reply) || '— изтрит отговор —'}“`,
    diff(old, { reply }, { reply: 'Отговор' }));
  refresh();
}

export async function markSeen(id) {
  const user = await requirePermission('notes.manage');
  const old = await loadNote(id);
  if (!old) return;
  await query("UPDATE notes SET status = 'seen' WHERE id = ?", [id]);
  await audit(user, 'seen', 'note', id, `Забележка на ${old.author} (${fmtDate(old.work_date)}) – отбелязана като прегледана`);
  refresh();
}
