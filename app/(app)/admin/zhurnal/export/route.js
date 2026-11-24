import { getCurrentUser, can } from '@/lib/auth';
import { ACTIONS, ENTITIES } from '@/lib/audit-labels';
import { fetchLog, device } from '@/lib/audit-query';
import { audit } from '@/lib/audit';

// CSV за Excel (UTF-8 с BOM, разделител ;)
export async function GET(req) {
  const user = await getCurrentUser();
  if (!can(user, 'audit.view')) return new Response('Нямате достъп', { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { rows } = await fetchLog(sp, { limit: 50000 });
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const changesText = (json) => {
    try {
      return Object.entries(JSON.parse(json) || {}).map(([k, [a, b]]) => `${k}: ${a ?? '—'} → ${b ?? '—'}`).join(' | ');
    } catch { return ''; }
  };
  const head = ['Дата и час', 'Потребител', 'Потребителско име', 'Действие', 'Обект', 'Описание', 'Промени', 'IP', 'Устройство'];
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push([
      r.created_at, r.current_name || r.full_name, r.username, ACTIONS[r.action] || r.action, ENTITIES[r.entity] || r.entity,
      r.summary, changesText(r.changes), r.ip, device(r.user_agent),
    ].map(esc).join(';'));
  }
  await audit(user, 'export', 'audit', null, `Експорт на журнала (${rows.length} записа)`);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="zhurnal-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
