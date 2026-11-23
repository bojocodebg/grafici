import Link from 'next/link';
import { requireUser, can } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { addLeave, reviewLeave, deleteLeave } from './actions';

export const metadata = { title: 'Отпуски – Пулс' };

const TYPE = { paid: 'Платен годишен', unpaid: 'Неплатен', sick: 'Болничен', other: 'Друг' };
const STATUS = { pending: ['Чака одобрение', 'warn'], approved: ['Одобрена', 'ok'], rejected: ['Отказана', 'bad'] };

function StatusBadge({ s }) {
  const [label, cls] = STATUS[s];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default async function LeavePage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const approve = can(user, 'leave.approve');

  const mine = await query(
    `SELECT l.*, r.full_name reviewer FROM leave_requests l LEFT JOIN users r ON r.id = l.reviewed_by
      WHERE l.user_id = ? ORDER BY l.date_from DESC`,
    [user.id]
  );
  const year = new Date().getFullYear();
  const usedPaid = mine
    .filter((l) => l.status === 'approved' && l.leave_type === 'paid' && l.date_from.startsWith(String(year)))
    .reduce((a, l) => a + l.days, 0);

  const st = ['pending', 'approved', 'rejected'].includes(sp.s) ? sp.s : 'pending';
  const all = approve
    ? await query(
        `SELECT l.*, u.full_name, p.name pharmacy, r.full_name reviewer
           FROM leave_requests l JOIN users u ON u.id = l.user_id
           LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
           LEFT JOIN users r ON r.id = l.reviewed_by
          WHERE l.status = ? ORDER BY l.date_from ${st === 'pending' ? 'ASC' : 'DESC'} LIMIT 300`,
        [st]
      )
    : [];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Отпуски</h1>
          <p className="muted">Подадените заявки не могат да се редактират от служителя. Одобрените отпуски се отбелязват в графика.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="card">
        <h2>Нова заявка за отпуск</h2>
        <form action={addLeave} className="form-grid">
          <label>Вид
            <select name="leave_type" defaultValue="paid">
              {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>От дата<input type="date" name="date_from" required /></label>
          <label>До дата<input type="date" name="date_to" required /></label>
          <label className="full">Причина / коментар<textarea name="reason" rows={2} maxLength={2000} /></label>
          <div className="full"><SubmitButton>Подай заявка</SubmitButton></div>
        </form>
      </section>

      <section className="card">
        <h2>Моите заявки</h2>
        <p className="muted">Одобрен платен отпуск през {year} г.: <b>{usedPaid}</b> дни</p>
        {mine.length === 0 ? <p className="muted">Нямате подадени заявки.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Период</th><th>Дни</th><th>Вид</th><th>Причина</th><th>Статус</th><th>Решение</th></tr></thead>
              <tbody>
                {mine.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.date_from)} – {fmtDate(l.date_to)}</td>
                    <td>{l.days}</td>
                    <td>{TYPE[l.leave_type]}</td>
                    <td className="pre">{l.reason}</td>
                    <td><StatusBadge s={l.status} /></td>
                    <td>{l.reviewer && <small>{l.reviewer}, {fmtDateTime(l.reviewed_at)}</small>}{l.review_comment && <div className="pre">{l.review_comment}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {approve && (
        <section className="card">
          <div className="section-head">
            <h2>Заявки на служителите</h2>
            <div className="toolbar">
              {Object.entries(STATUS).map(([k, [label]]) => (
                <Link key={k} className={`btn sm ${st === k ? 'primary' : ''}`} href={`/otpuski?s=${k}`}>{label}</Link>
              ))}
            </div>
          </div>
          {all.length === 0 ? <p className="muted">Няма заявки.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Служител</th><th>Период</th><th>Дни</th><th>Вид</th><th>Причина</th><th>Подадена</th><th>Действие</th></tr></thead>
                <tbody>
                  {all.map((l) => (
                    <tr key={l.id}>
                      <td><b>{l.full_name}</b><br /><small className="muted">{l.pharmacy}</small></td>
                      <td>{fmtDate(l.date_from)} – {fmtDate(l.date_to)}</td>
                      <td>{l.days}</td>
                      <td>{TYPE[l.leave_type]}</td>
                      <td className="pre">{l.reason}</td>
                      <td><small>{fmtDateTime(l.created_at)}</small></td>
                      <td>
                        {l.status === 'pending' ? (
                          <form className="stack-sm" action={reviewLeave.bind(null, l.id, 'approved')}>
                            <input name="comment" placeholder="Коментар (по избор)" />
                            <div className="inline">
                              <SubmitButton className="btn sm primary">Одобри</SubmitButton>
                              <SubmitButton className="btn sm danger" formAction={reviewLeave.bind(null, l.id, 'rejected')}>Откажи</SubmitButton>
                            </div>
                          </form>
                        ) : (
                          <div className="stack-sm">
                            <StatusBadge s={l.status} />
                            <small className="muted">{l.reviewer}{l.review_comment && `: ${l.review_comment}`}</small>
                            <div className="inline">
                              <form action={reviewLeave.bind(null, l.id, 'pending')}><SubmitButton className="btn sm">Върни за преглед</SubmitButton></form>
                              <form action={deleteLeave.bind(null, l.id)}><SubmitButton className="btn sm danger" confirm="Изтриване на заявката?">Изтрий</SubmitButton></form>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
