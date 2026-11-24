import 'server-only';
import { headers } from 'next/headers';
import { query } from './db';

const norm = (v) => (v === undefined || v === null || v === '' ? null : typeof v === 'boolean' ? (v ? 1 : 0) : String(v));

/**
 * Връща само променените полета: { 'Етикет': [старо, ново] }
 * fields: { ключ: 'Етикет' }
 */
export function diff(before, after, fields) {
  const out = {};
  for (const [key, label] of Object.entries(fields)) {
    const a = norm(before?.[key]);
    const b = norm(after?.[key]);
    if (a !== b) out[label] = [a, b];
  }
  return out;
}

/**
 * Записва действие в журнала. Никога не хвърля грешка – логването не бива да спира работата.
 * actor: { id, username, full_name } или null (напр. неуспешен вход)
 */
export async function audit(actor, action, entity, entityId, summary, changes = null) {
  try {
    let ip = null, ua = null;
    try {
      const h = await headers();
      ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null;
      ua = (h.get('user-agent') || '').slice(0, 255) || null;
    } catch { /* извън заявка */ }
    const hasChanges = changes && (Array.isArray(changes) ? changes.length : Object.keys(changes).length);
    await query(
      `INSERT INTO audit_log (user_id, username, full_name, action, entity, entity_id, summary, changes, ip, user_agent)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        actor?.id ?? null, actor?.username ?? null, actor?.full_name ?? null,
        action, entity, entityId ?? null, String(summary).slice(0, 500),
        hasChanges ? JSON.stringify(changes) : null, ip, ua,
      ]
    );
  } catch (e) {
    console.error('Грешка при запис в журнала:', e);
  }
}
