'use client';
import { useState, useTransition, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setShift, copyPreviousMonth, clearMonth } from './actions';

const ADMIN_ROW = { id: 'admin', full_name: 'Администрация' };

export default function ScheduleGrid({ days, workers, shiftTypes, shiftMap, leaveMap, noteMap = {}, canEdit, currentUserId, pharmacyId, year, month, today }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(null); // { userId, date, name }
  const [brush, setBrush] = useState(null); // избран тип смяна за бързо попълване
  const [local, setLocal] = useState({}); // оптимистични промени
  const [tip, setTip] = useState(null); // балон със забележки { x, y, notes, name, date }
  const hideTimer = useRef(null);
  const types = useMemo(() => Object.fromEntries(shiftTypes.map((t) => [t.id, t])), [shiftTypes]);

  const cellValue = (key) => (key in local ? local[key] : shiftMap[key]?.typeId ?? null);

  function save(userId, date, typeId) {
    const key = `${userId}|${date}`;
    setLocal((l) => ({ ...l, [key]: typeId }));
    startTransition(async () => {
      const revert = () => setLocal((l) => { const n = { ...l }; delete n[key]; return n; });
      try {
        const res = await setShift({ userId, date, shiftTypeId: typeId, pharmacyId });
        if (res?.error) { alert(res.error); revert(); }
        router.refresh();
      } catch (e) {
        alert('Грешка при запис: ' + e.message);
        revert();
      }
    });
  }

  function onCell(w, d) {
    if (!canEdit) return;
    const key = `${w.id}|${d.date}`;
    if (leaveMap[key]) {
      // В ден с одобрен отпуск не се добавя смяна; позволено е само изтриване на стар запис
      if (cellValue(key) !== null && confirm(`${w.full_name} е в одобрен отпуск на ${d.day}.${String(month).padStart(2, '0')}. Да се изтрие ли записаната смяна?`)) save(w.id, d.date, null);
      return;
    }
    if (brush !== null) {
      save(w.id, d.date, cellValue(key) === brush || brush === 0 ? null : brush);
    } else setPicker({ userId: w.id, date: d.date, name: w.full_name, weekday: d.weekday, day: d.day });
  }

  function showTip(e, w, d) {
    clearTimeout(hideTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 16);
    const x = Math.max(8, Math.min(r.left - 12, window.innerWidth - width - 8));
    const below = r.bottom + 220 < window.innerHeight;
    setTip({ x, y: below ? r.bottom + 6 : r.top - 6, below, notes: noteMap[`${w.id}|${d.date}`], name: w.full_name, date: d });
  }
  const hideTipSoon = () => { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setTip(null), 250); };
  const keepTip = () => clearTimeout(hideTimer.current);

  // Обобщение за служителя: часове по тип смяна + общо
  function summary(w) {
    const by = {};
    let total = 0;
    for (const d of days) {
      const t = types[cellValue(`${w.id}|${d.date}`)];
      if (!t) continue;
      total += t.hours;
      if (t.hours <= 0) continue;
      by[t.id] ??= { t, count: 0, hours: 0 };
      by[t.id].count++;
      by[t.id].hours += t.hours;
    }
    return { list: shiftTypes.filter((t) => by[t.id]).map((t) => by[t.id]), total };
  }

  // Брой хора на смяна за всеки ден (за контрол на покритието 24/7)
  const coverage = days.map((d) =>
    workers.reduce((acc, w) => {
      const t = types[cellValue(`${w.id}|${d.date}`)];
      if (t && t.hours > 0) acc[t.code] = (acc[t.code] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <div className="card grid-card">
      {canEdit && (
        <div className="brushbar no-print">
          <span className="muted">Режим на попълване:</span>
          <button className={`btn sm ${brush === null ? 'primary' : ''}`} onClick={() => setBrush(null)}>Избор с прозорец</button>
          {shiftTypes.map((t) => (
            <button key={t.id} className={`btn sm ${brush === t.id ? 'primary' : ''}`} onClick={() => setBrush(t.id)} title={t.name}>
              <span className="chip" style={{ background: t.color }}>{t.code}</span>
            </button>
          ))}
          <button className={`btn sm ${brush === 0 ? 'primary' : ''}`} onClick={() => setBrush(0)}>Гума</button>
          <span className="spacer" />
          <button className="btn sm" disabled={pending} onClick={() => {
            if (!confirm('Да се копира графикът от предходния месец? Вече въведените смени няма да бъдат променени.')) return;
            startTransition(async () => { const r = await copyPreviousMonth({ pharmacyId, year, month }); setLocal({}); router.refresh(); alert(`Копирани смени: ${r.copied}`); });
          }}>Копирай предх. месец</button>
          <button className="btn sm danger" disabled={pending} onClick={() => {
            if (!confirm('Да се изтрият ВСИЧКИ смени за този месец в тази аптека?')) return;
            startTransition(async () => { await clearMonth({ pharmacyId, year, month }); setLocal({}); router.refresh(); });
          }}>Изчисти месеца</button>
        </div>
      )}

      {workers.length === 0 ? (
        <p className="muted">Няма служители, зачислени към тази аптека.</p>
      ) : (
        <div className="grid-scroll">
          <table className="sched">
            <thead>
              <tr>
                <th className="sticky name">Служител</th>
                {days.map((d) => (
                  <th key={d.date} className={`${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''}`}>
                    <div>{d.day}</div><small>{d.weekday}</small>
                  </th>
                ))}
                <th>Часове</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const sum = summary(w);
                return (
                  <tr key={w.id} className={w.id === currentUserId ? 'me' : ''}>
                    <th className="sticky name">
                      {w.full_name}
                      {w.position && <small>{w.position}</small>}
                      <div className="sum">
                        {sum.list.map(({ t, count, hours }) => (
                          <span key={t.id} title={`${t.name}: ${count} бр. смени, ${hours} ч`}>
                            <i style={{ background: t.color }} />{t.code}: {hours} ч
                          </span>
                        ))}
                        <b>Общо: {sum.total} ч</b>
                      </div>
                    </th>
                    {days.map((d) => {
                      const key = `${w.id}|${d.date}`;
                      const t = types[cellValue(key)];
                      const other = shiftMap[key] && shiftMap[key].pharmacyId !== pharmacyId && !(key in local);
                      const leave = leaveMap[key];
                      const cellNotes = noteMap[key];
                      const locked = !!leave;
                      return (
                        <td
                          key={d.date}
                          className={`${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''} ${canEdit && !locked ? 'editable' : ''} ${locked ? 'locked' : ''} ${locked && t ? 'conflict' : ''}`}
                          onClick={() => onCell(w, d)}
                          title={locked ? `${leave} – не може да се добавя смяна${t ? ` (записана смяна: ${t.name} – кликнете, за да я изтриете)` : ''}` : t ? `${t.name}${t.start_time ? ` ${t.start_time}–${t.end_time}` : ''}${other ? ' (друга аптека)' : ''}` : ''}
                        >
                          {t ? (
                            <span className={`chip ${other ? 'other' : ''}`} style={{ background: t.color }}>{t.code}</span>
                          ) : leave ? (
                            <span className="chip leave">О</span>
                          ) : null}
                          {cellNotes && (
                            <span
                              className="note-dot"
                              onMouseEnter={(e) => showTip(e, w, d)}
                              onMouseLeave={hideTipSoon}
                              onClick={(e) => { e.stopPropagation(); showTip(e, w, d); }}
                              aria-label={`Забележки: ${cellNotes.length}`}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="total">{sum.total}</td>
                  </tr>
                );
              })}
              {days.some((d) => noteMap[`admin|${d.date}`]) && (
                <tr className="mgmt-row">
                  <th className="sticky name">
                    Администрация
                    <small>забележки</small>
                  </th>
                  {days.map((d) => (
                    <td key={d.date} className={`${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''}`}>
                      {noteMap[`admin|${d.date}`] && (
                        <span
                          className="note-dot"
                          onMouseEnter={(e) => showTip(e, ADMIN_ROW, d)}
                          onMouseLeave={hideTipSoon}
                          onClick={(e) => { e.stopPropagation(); showTip(e, ADMIN_ROW, d); }}
                          aria-label={`Забележки: ${noteMap[`admin|${d.date}`].length}`}
                        />
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky name">Покритие</th>
                {coverage.map((c, i) => (
                  <td key={i} className="cov">
                    {Object.entries(c).map(([code, n]) => <div key={code}>{code}:{n}</div>)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="legend">
        {shiftTypes.map((t) => (
          <span key={t.id}>
            <span className="chip" style={{ background: t.color }}>{t.code}</span> {t.name}
            {t.start_time && ` (${t.start_time}–${t.end_time})`}
          </span>
        ))}
        <span><span className="chip leave">О</span> Одобрен отпуск</span>
        <span><span className="note-dot legend-dot" /> Забележка (задръжте мишката)</span>
        {pending && <span className="muted">Записване…</span>}
      </div>

      {tip && (
        <div
          className={`note-tip ${tip.below ? '' : 'above'}`}
          style={{ left: tip.x, top: tip.y }}
          onMouseEnter={keepTip}
          onMouseLeave={hideTipSoon}
        >
          <div className="note-tip-head">
            <b>{tip.name}</b> · {tip.date.weekday}, {tip.date.day}.{String(month).padStart(2, '0')}
            <button className="x" onClick={() => setTip(null)} aria-label="Затвори">×</button>
          </div>
          {tip.notes.map((n) => (
            <div key={n.id} className="note-tip-item">
              {n.author && <small className="muted">{n.author}</small>}
              <p className="pre">{n.content}</p>
              {n.reply && <p className="pre reply-line"><b>{n.replier || 'Отговор'}:</b> {n.reply}</p>}
              <Link href={`/zabelezhki#note-${n.id}`}>Към забележката →</Link>
            </div>
          ))}
        </div>
      )}

      {picker && (
        <div className="modal-bg" onClick={() => setPicker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{picker.name}</h3>
            <p className="muted">{picker.weekday}, {picker.day}.{String(month).padStart(2, '0')}.{year}</p>
            <div className="pick-list">
              {shiftTypes.map((t) => (
                <button key={t.id} className="btn pick" onClick={() => { save(picker.userId, picker.date, t.id); setPicker(null); }}>
                  <span className="chip" style={{ background: t.color }}>{t.code}</span>
                  <span>{t.name}{t.start_time && <small> {t.start_time}–{t.end_time}</small>}</span>
                </button>
              ))}
              <button className="btn pick danger" onClick={() => { save(picker.userId, picker.date, null); setPicker(null); }}>Изчисти</button>
            </div>
            <button className="btn ghost" onClick={() => setPicker(null)}>Затвори</button>
          </div>
        </div>
      )}
    </div>
  );
}
