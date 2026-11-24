import Link from 'next/link';
import { requireUser, can } from '@/lib/auth';
import { query } from '@/lib/db';
import { MONTHS, monthDays, parseMonth, shiftMonth, monthKey, fmtTime, todayStr } from '@/lib/dates';
import ScheduleGrid from './ScheduleGrid';
import PrintButton from './PrintButton';

export const metadata = { title: 'График – Пулс' };

const LEAVE_LABEL = { paid: 'Платен отпуск', unpaid: 'Неплатен отпуск', sick: 'Болничен', other: 'Отпуск' };

export default async function SchedulePage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const viewAll = can(user, 'schedule.view_all');
  const canEdit = can(user, 'schedule.edit');
  const { year, month } = parseMonth(sp.m);
  const days = monthDays(year, month);
  const from = days[0].date, to = days.at(-1).date;

  const pharmacies = viewAll
    ? await query('SELECT id, name FROM pharmacies WHERE active = 1 ORDER BY name')
    : user.pharmacy_id ? [{ id: user.pharmacy_id, name: user.pharmacy_name }] : [];

  let pharmacyId = Number(sp.a) || user.pharmacy_id || pharmacies[0]?.id;
  if (!viewAll) pharmacyId = user.pharmacy_id;
  const pharmacy = pharmacies.find((p) => p.id === pharmacyId) || pharmacies[0];

  const shiftTypes = await query('SELECT * FROM shift_types WHERE active = 1 ORDER BY sort_order, id');

  let workers = [], shifts = [], leaves = [], notes = [], mgmtNotes = [];
  if (pharmacy) {
    workers = await query(
      `SELECT u.id, u.full_name, pos.name position FROM users u LEFT JOIN positions pos ON pos.id = u.position_id
        WHERE u.active = 1 AND u.pharmacy_id = ? ORDER BY pos.sort_order IS NULL, pos.sort_order, u.full_name`,
      [pharmacy.id]
    );
    const ids = workers.map((w) => w.id);
    if (ids.length) {
      shifts = await query(
        `SELECT s.user_id, s.work_date, s.shift_type_id, s.pharmacy_id
           FROM shifts s WHERE s.user_id IN (?) AND s.work_date BETWEEN ? AND ?`,
        [ids, from, to]
      );
      leaves = await query(
        `SELECT user_id, date_from, date_to, leave_type FROM leave_requests
          WHERE status = 'approved' AND user_id IN (?) AND date_from <= ? AND date_to >= ?`,
        [ids, to, from]
      );
      notes = await query(
        `SELECT n.id, n.user_id, n.work_date, n.content, n.reply, n.created_at, r.full_name replier
           FROM notes n LEFT JOIN users r ON r.id = n.replied_by
          WHERE n.user_id IN (?) AND n.work_date BETWEEN ? AND ? ORDER BY n.created_at`,
        [ids, from, to]
      );
    }
    // Забележки на администратори / потребители без аптека – виждат се в графика на всяка аптека
    mgmtNotes = await query(
      `SELECT n.id, n.work_date, n.content, n.reply, n.created_at, r.full_name replier, u.full_name author
         FROM notes n JOIN users u ON u.id = n.user_id
         LEFT JOIN users r ON r.id = n.replied_by
        WHERE (u.is_admin = 1 OR u.pharmacy_id IS NULL) AND u.id NOT IN (?)
          AND n.work_date BETWEEN ? AND ? ORDER BY n.created_at`,
      [ids.length ? ids : [0], from, to]
    );
  }

  const shiftMap = {};
  for (const s of shifts) shiftMap[`${s.user_id}|${s.work_date}`] = { typeId: s.shift_type_id, pharmacyId: s.pharmacy_id };
  const leaveMap = {};
  for (const l of leaves)
    for (const d of days) if (d.date >= l.date_from && d.date <= l.date_to) leaveMap[`${l.user_id}|${d.date}`] = LEAVE_LABEL[l.leave_type];

  const noteMap = {};
  for (const n of notes) (noteMap[`${n.user_id}|${n.work_date}`] ??= []).push({
    id: n.id, content: n.content, reply: n.reply, replier: n.replier, created: n.created_at,
  });
  for (const n of mgmtNotes) (noteMap[`admin|${n.work_date}`] ??= []).push({
    id: n.id, content: n.content, reply: n.reply, replier: n.replier, created: n.created_at, author: n.author,
  });

  // Личните смени на потребителя за месеца (във всички аптеки)
  const mine = await query(
    `SELECT s.work_date, st.code, st.name, st.start_time, st.end_time, st.hours, st.color, p.name pharmacy
       FROM shifts s JOIN shift_types st ON st.id = s.shift_type_id JOIN pharmacies p ON p.id = s.pharmacy_id
      WHERE s.user_id = ? AND s.work_date BETWEEN ? AND ? ORDER BY s.work_date`,
    [user.id, from, to]
  );
  const myHours = mine.reduce((a, s) => a + Number(s.hours), 0);
  const today = todayStr();

  const q = (m, a) => `/grafik?m=${m}${a ? `&a=${a}` : ''}`;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>График за {MONTHS[month - 1].toLowerCase()} {year}</h1>
          <p className="muted">{pharmacy ? pharmacy.name : 'Нямате зададена аптека'}{!canEdit && ' · само за преглед'}</p>
        </div>
        <div className="toolbar no-print">
          <Link className="btn" href={q(shiftMonth(year, month, -1), viewAll && pharmacy?.id)}>‹ Предходен</Link>
          <Link className="btn" href={q(monthKey(new Date().getFullYear(), new Date().getMonth() + 1), viewAll && pharmacy?.id)}>Текущ</Link>
          <Link className="btn" href={q(shiftMonth(year, month, 1), viewAll && pharmacy?.id)}>Следващ ›</Link>
          {viewAll && pharmacies.length > 1 && (
            <form className="inline" action="/grafik">
              <input type="hidden" name="m" value={monthKey(year, month)} />
              <select name="a" defaultValue={pharmacy?.id} className="auto-submit">
                {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn">Покажи</button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {!pharmacy ? (
        <div className="alert">Не сте зачислен към аптека. Свържете се с администратор.</div>
      ) : (
        <ScheduleGrid
          days={days}
          workers={workers}
          shiftTypes={shiftTypes.map((t) => ({ ...t, hours: Number(t.hours), start_time: fmtTime(t.start_time), end_time: fmtTime(t.end_time) }))}
          shiftMap={shiftMap}
          leaveMap={leaveMap}
          noteMap={noteMap}
          canEdit={canEdit}
          currentUserId={user.id}
          pharmacyId={pharmacy.id}
          year={year}
          month={month}
          today={today}
        />
      )}

      <section className="card no-print">
        <h2>Моите смени – {MONTHS[month - 1].toLowerCase()} {year}</h2>
        {mine.length === 0 ? (
          <p className="muted">Нямате въведени смени за този месец.</p>
        ) : (
          <>
            <table className="table cards">
              <thead><tr><th>Дата</th><th>Смяна</th><th>Час</th><th>Часове</th><th>Аптека</th></tr></thead>
              <tbody>
                {mine.map((s) => {
                  const d = days.find((x) => x.date === s.work_date);
                  return (
                    <tr key={s.work_date} className={s.work_date === today ? 'hl' : ''}>
                      <td data-label="Дата"><b>{d?.weekday}, {s.work_date.slice(8)}.{s.work_date.slice(5, 7)}</b></td>
                      <td data-label="Смяна"><span className="chip" style={{ background: s.color }}>{s.code}</span> {s.name}</td>
                      <td data-label="Час">{s.start_time ? `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}` : '—'}</td>
                      <td data-label="Часове">{Number(s.hours)}</td>
                      <td data-label="Аптека">{s.pharmacy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted">Общо часове: <b>{myHours}</b></p>
          </>
        )}
      </section>
    </div>
  );
}
