import Link from 'next/link';
import { requireUser, can } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { addNote, editNote, deleteNote, replyNote, markSeen } from './actions';

export const metadata = { title: 'Забележки – Пулс' };

export default async function NotesPage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manage = can(user, 'notes.manage');
  const admin = user.is_admin;

  const where = [];
  const params = [];
  if (sp.f === 'mine') { where.push('n.user_id = ?'); params.push(user.id); }
  if (sp.f === 'new') where.push("n.status = 'new'");
  if (Number(sp.a)) { where.push('u.pharmacy_id = ?'); params.push(Number(sp.a)); }

  const [notes, pharmacies] = await Promise.all([
    query(
      `SELECT n.*, u.full_name, p.name pharmacy, r.full_name replier
         FROM notes n JOIN users u ON u.id = n.user_id
         LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
         LEFT JOIN users r ON r.id = n.replied_by
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY n.created_at DESC LIMIT 500`,
      params
    ),
    query('SELECT id, name FROM pharmacies WHERE active = 1 ORDER BY name'),
  ]);

  const href = (f, a = sp.a) => {
    const q = new URLSearchParams();
    if (f) q.set('f', f);
    if (a) q.set('a', a);
    const s = q.toString();
    return '/zabelezhki' + (s ? '?' + s : '');
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Забележки</h1>
          <p className="muted">Забележките се виждат от всички служители. След изпращане могат да се редактират или изтриват само от администратор.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="card">
        <h2>Нова забележка</h2>
        <form action={addNote} className="form-grid">
          <label>Отнася се за дата (по избор)<input type="date" name="work_date" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(sp.d || '') ? sp.d : undefined} /></label>
          <label className="full">Текст<textarea name="content" rows={3} maxLength={2000} required placeholder="Напр. „Моля за размяна на смяната на 12-ти с колега…“" /></label>
          <div className="full"><SubmitButton>Изпрати</SubmitButton></div>
        </form>
        <p className="muted small">Забележките с дата се показват в графика с червена точка в съответния ден.</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Всички забележки</h2>
          <div className="toolbar">
            <Link className={`btn sm ${!sp.f ? 'primary' : ''}`} href={href('')}>Всички</Link>
            <Link className={`btn sm ${sp.f === 'mine' ? 'primary' : ''}`} href={href('mine')}>Моите</Link>
            {manage && <Link className={`btn sm ${sp.f === 'new' ? 'primary' : ''}`} href={href('new')}>Нови</Link>}
            {pharmacies.length > 1 && (
              <form className="inline" action="/zabelezhki">
                {sp.f && <input type="hidden" name="f" value={sp.f} />}
                <select name="a" defaultValue={sp.a || ''}>
                  <option value="">Всички аптеки</option>
                  {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn sm">Филтър</button>
              </form>
            )}
          </div>
        </div>
        {notes.length === 0 && <p className="muted">Няма забележки.</p>}
        <div className="stack">
          {notes.map((n) => (
            <article key={n.id} id={`note-${n.id}`} className={`note ${n.status === 'new' ? 'new' : ''} ${n.user_id === user.id ? 'mine' : ''}`}>
              <header>
                <b>{n.full_name}</b>
                {n.pharmacy && <span className="muted"> · {n.pharmacy}</span>}
                <span className="muted"> · {fmtDateTime(n.created_at)}</span>
                {n.work_date && (
                  <Link className="badge" href={`/grafik?m=${n.work_date.slice(0, 7)}`} title="Отвори графика за месеца">за {fmtDate(n.work_date)}</Link>
                )}
                <span className={`badge ${n.status === 'new' ? 'warn' : 'ok'}`}>{n.status === 'new' ? 'Нова' : 'Прегледана'}</span>
              </header>
              <p className="pre">{n.content}</p>
              {n.reply && (
                <div className="reply">
                  <small className="muted">Отговор от {n.replier || '—'} · {fmtDateTime(n.replied_at)}</small>
                  <p className="pre">{n.reply}</p>
                </div>
              )}
              {(manage || admin) && (
                <div className="note-actions">
                  {manage && (
                    <form action={replyNote.bind(null, n.id)} className="inline grow">
                      <input name="reply" placeholder="Отговор…" defaultValue={n.reply || ''} />
                      <SubmitButton className="btn sm primary">Отговори</SubmitButton>
                    </form>
                  )}
                  {manage && n.status === 'new' && (
                    <form action={markSeen.bind(null, n.id)}><SubmitButton className="btn sm">Прегледана</SubmitButton></form>
                  )}
                  {admin && (
                    <form action={deleteNote.bind(null, n.id)}><SubmitButton className="btn sm danger" confirm="Изтриване на забележката?">Изтрий</SubmitButton></form>
                  )}
                </div>
              )}
              {admin && (
                <details className="edit-note">
                  <summary>Редактирай</summary>
                  <form action={editNote.bind(null, n.id)} className="form-grid">
                    <label>Дата<input type="date" name="work_date" defaultValue={n.work_date || ''} /></label>
                    <label className="full">Текст<textarea name="content" rows={3} maxLength={2000} required defaultValue={n.content} /></label>
                    <div className="full"><SubmitButton className="btn sm primary">Запиши</SubmitButton></div>
                  </form>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
