'use client';
import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { setShift, copyPreviousMonth, clearMonth } from './actions';

export default function ScheduleGrid({ days, workers, shiftTypes, shiftMap, leaveMap, canEdit, currentUserId, pharmacyId, year, month, today }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(null); // { userId, date, name }
  const [brush, setBrush] = useState(null); // избран тип смяна за бързо попълване
  const [local, setLocal] = useState({}); // оптимистични промени
  const types = useMemo(() => Object.fromEntries(shiftTypes.map((t) => [t.id, t])), [shiftTypes]);

  const cellValue = (key) => (key in local ? local[key] : shiftMap[key]?.typeId ?? null);

  function save(userId, date, typeId) {
    const key = `${userId}|${date}`;
    setLocal((l) => ({ ...l, [key]: typeId }));
    startTransition(async () => {
      try {
        await setShift({ userId, date, shiftTypeId: typeId, pharmacyId });
        router.refresh();
      } catch (e) {
        alert('Грешка при запис: ' + e.message);
        setLocal((l) => { const n = { ...l }; delete n[key]; return n; });
      }
    });
  }

  function onCell(w, d) {
    if (!canEdit) return;
    if (brush !== null) {
      const key = `${w.id}|${d.date}`;
      save(w.id, d.date, cellValue(key) === brush || brush === 0 ? null : brush);
    } else setPicker({ userId: w.id, date: d.date, name: w.full_name, weekday: d.weekday, day: d.day });
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
                let total = 0;
                return (
                  <tr key={w.id} className={w.id === currentUserId ? 'me' : ''}>
                    <th className="sticky name">
                      {w.full_name}
                      {w.position && <small>{w.position}</small>}
                    </th>
                    {days.map((d) => {
                      const key = `${w.id}|${d.date}`;
                      const t = types[cellValue(key)];
                      const other = shiftMap[key] && shiftMap[key].pharmacyId !== pharmacyId && !(key in local);
                      const leave = leaveMap[key];
                      if (t) total += t.hours;
                      return (
                        <td
                          key={d.date}
                          className={`${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''} ${canEdit ? 'editable' : ''}`}
                          onClick={() => onCell(w, d)}
                          title={t ? `${t.name}${t.start_time ? ` ${t.start_time}–${t.end_time}` : ''}${other ? ' (друга аптека)' : ''}` : leave || ''}
                        >
                          {t ? (
                            <span className={`chip ${other ? 'other' : ''}`} style={{ background: t.color }}>{t.code}</span>
                          ) : leave ? (
                            <span className="chip leave">О</span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="total">{total}</td>
                  </tr>
                );
              })}
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
        {pending && <span className="muted">Записване…</span>}
      </div>

      {picker && (
        <div className="modal-bg" onClick={() => setPicker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{picker.name}</h3>
            <p className="muted">{picker.weekday}, {picker.day}.{String(month).padStart(2, '0')}.{year}</p>
            {leaveMap[`${picker.userId}|${picker.date}`] && (
              <div className="alert">Служителят е в одобрен отпуск ({leaveMap[`${picker.userId}|${picker.date}`]}).</div>
            )}
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
