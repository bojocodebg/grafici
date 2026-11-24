'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, requirePermission, requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const back = (k, msg) => redirect('/zabelezhki?' + k + '=' + encodeURIComponent(msg));
const refresh = () => { revalidatePath('/zabelezhki'); revalidatePath('/grafik'); };

// Всеки потребител може да добави забележка. Всички забележки се виждат от всички,
// но редакция и изтриване може да прави само администратор.
export async function addNote(formData) {
  const user = await requireUser();
  const content = String(formData.get('content') || '').trim();
  const date = String(formData.get('work_date') || '');
  if (!content) back('error', 'Въведете текст на забележката.');
  if (content.length > 2000) back('error', 'Текстът е твърде дълъг (макс. 2000 знака).');
  await query('INSERT INTO notes (user_id, work_date, content) VALUES (?,?,?)', [user.id, DATE_RE.test(date) ? date : null, content]);
  refresh();
  back('ok', 'Забележката е изпратена.');
}

export async function editNote(id, formData) {
  await requireAdmin();
  const content = String(formData.get('content') || '').trim();
  const date = String(formData.get('work_date') || '');
  if (!content) back('error', 'Текстът на забележката не може да е празен.');
  await query('UPDATE notes SET content = ?, work_date = ? WHERE id = ?', [content.slice(0, 2000), DATE_RE.test(date) ? date : null, id]);
  refresh();
  back('ok', 'Забележката е редактирана.');
}

export async function deleteNote(id) {
  await requireAdmin();
  await query('DELETE FROM notes WHERE id = ?', [id]);
  refresh();
}

export async function replyNote(id, formData) {
  const admin = await requirePermission('notes.manage');
  const reply = String(formData.get('reply') || '').trim();
  await query("UPDATE notes SET reply = ?, replied_by = ?, replied_at = NOW(), status = 'seen' WHERE id = ?", [reply || null, admin.id, id]);
  refresh();
}

export async function markSeen(id) {
  await requirePermission('notes.manage');
  await query("UPDATE notes SET status = 'seen' WHERE id = ?", [id]);
  refresh();
}
