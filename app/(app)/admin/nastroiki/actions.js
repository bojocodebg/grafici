'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getSettings, saveSettings, SETTINGS } from '@/lib/settings';
import { audit } from '@/lib/audit';

export async function updateSettings(formData) {
  const admin = await requireAdmin();
  const before = await getSettings();
  const input = {};
  for (const name of Object.keys(SETTINGS)) if (formData.has(name)) input[name] = formData.get(name);
  const after = await saveSettings(input);
  const changes = {};
  for (const [k, v] of Object.entries(after)) if (before[k] !== v) changes[SETTINGS[k].label] = [String(before[k]), String(v)];
  if (Object.keys(changes).length) await audit(admin, 'update', 'settings', null, 'Променени системни настройки', changes);
  revalidatePath('/', 'layout');
  redirect('/admin/nastroiki?ok=' + encodeURIComponent(Object.keys(changes).length ? 'Настройките са запазени.' : 'Няма промени.'));
}
