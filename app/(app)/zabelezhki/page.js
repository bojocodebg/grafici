import Link from 'next/link';
import { requireUser, can } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { addNote, replyNote, markSeen, deleteNote } from './actions';

export const metadata = { title: 'Забележки – Пулс' };

export default async function NotesPage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const manage = can(user, 'notes.manage');
  const showAll = manage && sp.view !== 'mine';
  const filter = sp.f === 'new' ? "AND n.status = 'new'" : '';

  const notes = await query(
    `SELECT n.*, u.full_name, p.name pharmacy, r.full_name replier
       FROM notes n JOIN users u ON u.id = n.user_id
       LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
       LEFT JOIN users r ON r.id = n.replied_by
      WHERE ${showAll ? '1=1' : 'n.user_id = ?'} ${filter}
      ORDER BY n.created_at DESC LIMIT 300`,
    showAll ? [] : [user.id]
  );

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Забележки</h1>
          <p className="muted">Изпратете забележка към графика или към ръководството. След изпращане забележката не може да се променя.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="card">
        <h2>Нова забележка</h2>
        <form action={addNote} className="form-grid">
          <label>Отнася се за дата (по избор)<input type="date" name="work_date" /></label>
          <label className="full">Текст<textarea name="content" rows={3} maxLength={2000} required placeholder="Напр. „Моля за размяна на смяната на 12-ти с колега…“" /></label>
          <div className="full"><SubmitButton>Изпрати</SubmitButton></div>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{showAll ? 'Всички забележки' : 'Моите забележки'}</h2>
          {manage && (
            <div className="toolbar">
              <Link className={`btn sm ${showAll && sp.f !== 'new' ? 'primary' : ''}`} href="/zabelezhki">Всички</Link>
              <Link className={`btn sm ${sp.f === 'new' ? 'primary' : ''}`} href="/zabelezhki?f=new">Нови</Link>
              <Link className={`btn sm ${!showAll ? 'primary' : ''}`} href="/zabelezhki?view=mine">Моите</Link>
            </div>
          )}
        </div>
        {notes.length === 0 && <p className="muted">Няма забележки.</p>}
        <div className="stack">
          {notes.map((n) => (
            <article key={n.id} className={`note ${n.status === 'new' ? 'new' : ''}`}>
              <header>
                <b>{n.full_name}</b>
                {showAll && n.pharmacy && <span className="muted"> · {n.pharmacy}</span>}
                <span className="muted"> · {fmtDateTime(n.created_at)}</span>
                {n.work_date && <span className="badge">за {fmtDate(n.work_date)}</span>}
                <span className={`badge ${n.status === 'new' ? 'warn' : 'ok'}`}>{n.status === 'new' ? 'Нова' : 'Прегледана'}</span>
              </header>
              <p className="pre">{n.content}</p>
              {n.reply && (
                <div className="reply">
                  <small className="muted">Отговор от {n.replier || '—'} · {fmtDateTime(n.replied_at)}</small>
                  <p className="pre">{n.reply}</p>
                </div>
              )}
              {manage && (
                <div className="note-actions">
                  <form action={replyNote.bind(null, n.id)} className="inline grow">
                    <input name="reply" placeholder="Отговор…" defaultValue={n.reply || ''} />
                    <SubmitButton className="btn sm primary">Отговори</SubmitButton>
                  </form>
                  {n.status === 'new' && (
                    <form action={markSeen.bind(null, n.id)}><SubmitButton className="btn sm">Прегледана</SubmitButton></form>
                  )}
                  <form action={deleteNote.bind(null, n.id)}><SubmitButton className="btn sm danger" confirm="Изтриване на забележката?">Изтрий</SubmitButton></form>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
