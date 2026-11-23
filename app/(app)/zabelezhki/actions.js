'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';

// Всеки потребител може да добави забележка. Редакция/изтриване няма за автора –
// след подаване забележката е само за четене.
export async function addNote(formData) {
  const user = await requireUser();
  const content = String(formData.get('content') || '').trim();
  const date = String(formData.get('work_date') || '');
  if (!content) redirect('/zabelezhki?error=' + encodeURIComponent('Въведете текст на забележката.'));
  if (content.length > 2000) redirect('/zabelezhki?error=' + encodeURIComponent('Текстът е твърде дълъг (макс. 2000 знака).'));
  await query('INSERT INTO notes (user_id, work_date, content) VALUES (?,?,?)', [
    user.id, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, content,
  ]);
  revalidatePath('/zabelezhki');
  redirect('/zabelezhki?ok=' + encodeURIComponent('Забележката е изпратена.'));
}

export async function replyNote(id, formData) {
  const admin = await requirePermission('notes.manage');
  const reply = String(formData.get('reply') || '').trim();
  await query("UPDATE notes SET reply = ?, replied_by = ?, replied_at = NOW(), status = 'seen' WHERE id = ?", [reply || null, admin.id, id]);
  revalidatePath('/zabelezhki');
}

export async function markSeen(id) {
  await requirePermission('notes.manage');
  await query("UPDATE notes SET status = 'seen' WHERE id = ?", [id]);
  revalidatePath('/zabelezhki');
}

export async function deleteNote(id) {
  await requirePermission('notes.manage');
  await query('DELETE FROM notes WHERE id = ?', [id]);
  revalidatePath('/zabelezhki');
}
