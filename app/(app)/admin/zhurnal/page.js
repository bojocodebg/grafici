import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtDateTime } from '@/lib/dates';
import { ACTIONS, ENTITIES, ACTION_TONE } from '@/lib/audit-labels';
import { fetchLog, device, PAGE_SIZE } from '@/lib/audit-query';
import DateInput from '@/app/components/DateInput';

export const metadata = { title: 'Журнал – Пулс' };

function Changes({ json }) {
  let ch;
  try { ch = JSON.parse(json); } catch { return null; }
  const entries = Object.entries(ch || {});
  if (!entries.length) return null;
  return (
    <table className="changes">
      <thead><tr><th>Поле</th><th>Преди</th><th>След</th></tr></thead>
      <tbody>
        {entries.map(([k, [a, b]]) => (
          <tr key={k}>
            <th>{k}</th>
            <td className="old">{a ?? <span className="muted">—</span>}</td>
            <td className="new">{b ?? <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function LogPage({ searchParams }) {
  const sp = await searchParams;
  await requirePermission('audit.view');
  const page = Math.max(1, Number(sp.p) || 1);
  const { rows, total } = await fetchLog(sp, { offset: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Всички потребители, които имат записи (вкл. изтрити – по запазеното име)
  const users = await query(
    `SELECT a.user_id id, COALESCE(MAX(u.full_name), MAX(a.full_name), MAX(a.username)) name, MAX(a.username) username, MAX(u.id IS NULL) deleted
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.user_id IS NOT NULL
      GROUP BY a.user_id ORDER BY name`
  );

  const qs = (over) => {
    const q = new URLSearchParams();
    for (const k of ['u', 'e', 'act', 'from', 'to', 'q']) if (sp[k]) q.set(k, sp[k]);
    for (const [k, v] of Object.entries(over)) v ? q.set(k, v) : q.delete(k);
    const s = q.toString();
    return s ? '?' + s : '';
  };
  const filtered = ['u', 'e', 'act', 'from', 'to', 'q'].some((k) => sp[k]);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Журнал на действията</h1>
          <p className="muted">Входове и всички промени, направени от потребителите (вкл. администратори).</p>
        </div>
        <div className="toolbar">
          <a className="btn" href={`/admin/zhurnal/export${qs({})}`}>Експорт (CSV)</a>
        </div>
      </div>

      <section className="card">
        <form className="filters" action="/admin/zhurnal">
          <label>Потребител
            <select name="u" defaultValue={sp.u || ''}>
              <option value="">Всички</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username}){u.deleted ? ' – изтрит' : ''}</option>)}
              <option value="none">Без потребител (неуспешни входове)</option>
            </select>
          </label>
          <label>Обект
            <select name="e" defaultValue={sp.e || ''}>
              <option value="">Всички</option>
              {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Действие
            <select name="act" defaultValue={sp.act || ''}>
              <option value="">Всички</option>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>От дата<DateInput name="from" defaultValue={sp.from || ''} /></label>
          <label>До дата<DateInput name="to" defaultValue={sp.to || ''} /></label>
          <label className="wide">Търсене в текста / IP<input name="q" defaultValue={sp.q || ''} placeholder="напр. име, дата, „Нощна“…" /></label>
          <div className="filter-actions">
            <button className="btn primary">Филтрирай</button>
            {filtered && <Link className="btn" href="/admin/zhurnal">Изчисти</Link>}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Записи: {total}</h2>
          {pages > 1 && <span className="muted">Страница {page} от {pages}</span>}
        </div>
        {rows.length === 0 ? <p className="muted">Няма записи по зададените филтри.</p> : (
          <ol className="log-list">
            {rows.map((r) => (
              <li key={r.id} className="log-item">
                <div className="log-meta">
                  <time dateTime={r.created_at}>{fmtDateTime(r.created_at)}<small>:{String(r.created_at).slice(17, 19)}</small></time>
                  <span className={`badge ${ACTION_TONE[r.action] || ''}`}>{ACTIONS[r.action] || r.action}</span>
                  <span className="badge">{ENTITIES[r.entity] || r.entity}</span>
                </div>
                <div className="log-body">
                  <div className="log-who">
                    {r.user_id ? (
                      <Link href={`/admin/zhurnal${qs({ u: String(r.user_id), p: '' })}`} title="Само действията на този потребител">
                        {r.current_name || r.full_name || r.username}
                      </Link>
                    ) : <span>{r.username || '—'}</span>}
                    {r.username && <small className="muted"> · {r.username}</small>}
                    {r.user_id && !r.current_name && <small className="muted"> (изтрит)</small>}
                  </div>
                  <p className="log-summary">{r.summary}</p>
                  {(r.changes || r.ip || r.user_agent) && (
                    <details className="log-details">
                      <summary>Подробности</summary>
                      <Changes json={r.changes} />
                      <p className="muted small">
                        {r.ip && <>IP: {r.ip} · </>}{device(r.user_agent)}
                      </p>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {pages > 1 && (
          <nav className="pager" aria-label="Страници">
            {page > 1 ? <Link className="btn sm" href={`/admin/zhurnal${qs({ p: String(page - 1) })}`}>‹ По-нови</Link> : <span />}
            <span className="muted">{page} / {pages}</span>
            {page < pages ? <Link className="btn sm" href={`/admin/zhurnal${qs({ p: String(page + 1) })}`}>По-стари ›</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
