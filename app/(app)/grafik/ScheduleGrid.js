'use client';
import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setShift, copyPreviousMonth, clearMonth } from './actions';

const ADMIN_ROW = { id: 'admin', full_name: 'Администрация' };

export default function ScheduleGrid({ days, workers, shiftTypes, shiftMap, leaveMap, noteMap = {}, canEdit, currentUserId, pharmacyId, pharmacyName, year, month, today }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(null); // { userId, date, name }
  const [brush, setBrush] = useState(null); // избран тип смяна за бързо попълване
  const [local, setLocal] = useState({}); // оптимистични промени
  const [tip, setTip] = useState(null); // балон със забележки { x, y, notes, name, date }
  const hideTimer = useRef(null);
  const [clearOpen, setClearOpen] = useState(false); // прозорец „напишете DELETE“
  const [clearText, setClearText] = useState('');
  // Изглед: auto – таблица на широк екран, карти по дни на тесен; може да се избере ръчно
  const [view, setView] = useState('auto');
  useEffect(() => { try { const v = localStorage.getItem('grafik-view'); if (v) setView(v); } catch {} }, []);
  const chooseView = (v) => { setView(v); try { localStorage.setItem('grafik-view', v); } catch {} };
  const types = useMemo(() => Object.fromEntries(shiftTypes.map((t) => [t.id, t])), [shiftTypes]);

  const cellValue = (key) => (key in local ? local[key] : shiftMap[key]?.typeId ?? null);
  // Смяна, записана в ДРУГА аптека (за служители, които работят във всички аптеки)
  const otherPharmacy = (key) => (!(key in local) && shiftMap[key] && shiftMap[key].pharmacyId !== pharmacyId ? shiftMap[key].pharmacy : null);

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
    const elsewhere = otherPharmacy(key);
    if (elsewhere) {
      const t = types[cellValue(key)];
      const what = brush === 0 ? 'изтриете' : `промените и преместите в ${pharmacyName}`;
      if (!confirm(`${w.full_name} вече има смяна ${t?.code || ''} в ${elsewhere} на ${d.day}.${String(month).padStart(2, '0')}.\nИскате ли да я ${what}?`)) return;
    }
    if (brush !== null) {
      save(w.id, d.date, (!elsewhere && cellValue(key) === brush) || brush === 0 ? null : brush);
    } else setPicker({ userId: w.id, date: d.date, name: w.full_name, weekday: d.weekday, day: d.day, elsewhere });
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
    let total = 0, elsewhere = 0;
    for (const d of days) {
      const t = types[cellValue(`${w.id}|${d.date}`)];
      if (!t) continue;
      total += t.hours;
      if (otherPharmacy(`${w.id}|${d.date}`)) elsewhere += t.hours;
      if (t.hours <= 0) continue;
      by[t.id] ??= { t, count: 0, hours: 0 };
      by[t.id].count++;
      by[t.id].hours += t.hours;
    }
    return { list: shiftTypes.filter((t) => by[t.id]).map((t) => by[t.id]), total, elsewhere };
  }

  // Брой хора на смяна за всеки ден (за контрол на покритието 24/7)
  const coverage = days.map((d) =>
    workers.reduce((acc, w) => {
      const t = otherPharmacy(`${w.id}|${d.date}`) ? null : types[cellValue(`${w.id}|${d.date}`)];
      if (t && t.hours > 0) acc[t.code] = (acc[t.code] || 0) + 1;
      return acc;
    }, {})
  );

  const sums = Object.fromEntries(workers.map((w) => [w.id, summary(w)]));
  const fmtDay = (d) => `${d.day}.${String(month).padStart(2, '0')}`;

  return (
    <div className="card grid-card">
      <div className="view-switch no-print" role="group" aria-label="Изглед на графика">
        <span className="muted">Изглед:</span>
        {[['auto', 'Автоматичен'], ['table', 'Таблица'], ['days', 'По дни']].map(([v, label]) => (
          <button key={v} type="button" className={`btn sm ${view === v ? 'primary' : ''}`} aria-pressed={view === v} onClick={() => chooseView(v)}>{label}</button>
        ))}
      </div>
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
            setClearText(''); setClearOpen(true); // второ потвърждение – писане на DELETE
          }}>Изчисти месеца</button>
        </div>
      )}

      {workers.length === 0 ? (
        <p className="muted">Няма служители, зачислени към тази аптека.</p>
      ) : (
        <div className={`sched-views view-${view}`}>
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
                const sum = sums[w.id];
                return (
                  <tr key={w.id} className={w.id === currentUserId ? 'me' : ''}>
                    <th className="sticky name">
                      {w.full_name}
                      {w.position && <small>{w.position}</small>}
                      {w.floating && <small className="float-tag" title="Може да получава смени във всички аптеки">⇄ {w.home_pharmacy ? `от ${w.home_pharmacy}` : 'всички аптеки'}</small>}
                      <div className="sum">
                        {sum.list.map(({ t, count, hours }) => (
                          <span key={t.id} title={`${t.name}: ${count} бр. смени, ${hours} ч`}>
                            <i style={{ background: t.color }} />{t.code}: {hours} ч
                          </span>
                        ))}
                        <b>Общо: {sum.total} ч</b>
                        {sum.elsewhere > 0 && <span className="muted" title="Включени в общото">(в др. аптеки: {sum.elsewhere} ч)</span>}
                      </div>
                    </th>
                    {days.map((d) => {
                      const key = `${w.id}|${d.date}`;
                      const t = types[cellValue(key)];
                      const other = otherPharmacy(key);
                      const leave = leaveMap[key];
                      const cellNotes = noteMap[key];
                      const locked = !!leave;
                      return (
                        <td
                          key={d.date}
                          className={`${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''} ${canEdit && !locked ? 'editable' : ''} ${locked ? 'locked' : ''} ${locked && t ? 'conflict' : ''}`}
                          onClick={() => onCell(w, d)}
                          title={locked ? `${leave} – не може да се добавя смяна${t ? ` (записана смяна: ${t.name} – кликнете, за да я изтриете)` : ''}` : t ? `${t.name}${t.start_time ? ` ${t.start_time}–${t.end_time}` : ''}${other ? ` (в ${other})` : ''}` : ''}
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

        {/* ---- Изглед „По дни“ ---- */}
        <div className="agenda">
          <section className="agenda-summary">
            <h3>Часове за месеца</h3>
            <ul>
              {workers.map((w) => (
                <li key={w.id} className={w.id === currentUserId ? 'me' : ''}>
                  <span className="who"><b>{w.full_name}</b>{w.position && <small>{w.position}</small>}{w.floating && <small className="float-tag">⇄ {w.home_pharmacy ? `от ${w.home_pharmacy}` : 'всички аптеки'}</small>}</span>
                  <span className="sum">
                    {sums[w.id].list.map(({ t, hours }) => (
                      <span key={t.id}><i style={{ background: t.color }} />{t.code}: {hours} ч</span>
                    ))}
                    <b>Общо: {sums[w.id].total} ч</b>
                    {sums[w.id].elsewhere > 0 && <span className="muted">(в др. аптеки: {sums[w.id].elsewhere} ч)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <div className="day-cards">
            {days.map((d) => {
              const adminNotes = noteMap[`admin|${d.date}`];
              return (
                <article key={d.date} className={`day-card ${d.weekend ? 'we' : ''} ${d.date === today ? 'today' : ''}`} id={`den-${d.day}`}>
                  <header>
                    <b>{d.weekday}, {fmtDay(d)}</b>
                    {d.date === today && <span className="badge ok">Днес</span>}
                    <span className="cov">{Object.entries(coverage[d.day - 1]).map(([c, n]) => `${c}:${n}`).join(' ')}</span>
                  </header>
                  <ul>
                    {workers.map((w) => {
                      const key = `${w.id}|${d.date}`;
                      const t = types[cellValue(key)];
                      const leave = leaveMap[key];
                      const cellNotes = noteMap[key];
                      const editable = canEdit && !leave;
                      const other = otherPharmacy(key);
                      return (
                        <li key={w.id} className={`${w.id === currentUserId ? 'me' : ''} ${leave && t ? 'conflict' : ''}`}>
                          <button
                            type="button"
                            className="day-row"
                            disabled={!canEdit || (leave && !t)}
                            onClick={() => onCell(w, d)}
                            aria-label={`${w.full_name}, ${fmtDay(d)}${editable ? ' – промени смяната' : ''}`}
                          >
                            <span className="who">{w.full_name}</span>
                            {t ? (
                              <span className={`what ${other ? 'elsewhere' : ''}`}><span className={`chip ${other ? 'other' : ''}`} style={{ background: t.color }}>{t.code}</span><span className="tname">{other ? <>в {other}</> : t.name}{!other && t.start_time && <small> {t.start_time}–{t.end_time}</small>}</span></span>
                            ) : leave ? (
                              <span className="what"><span className="chip leave">О</span><span className="tname">{leave}</span></span>
                            ) : (
                              <span className="what muted">{canEdit ? '+ смяна' : '—'}</span>
                            )}
                          </button>
                          {cellNotes && (
                            <span className="note-dot inline-dot" role="button" tabIndex={0} aria-label={`Забележки: ${cellNotes.length}`}
                              onClick={(e) => showTip(e, w, d)} onKeyDown={(e) => e.key === 'Enter' && showTip(e, w, d)} />
                          )}
                        </li>
                      );
                    })}
                    {adminNotes && (
                      <li className="mgmt">
                        <span className="day-row static"><span className="who">Администрация</span><span className="what muted">забележка</span></span>
                        <span className="note-dot inline-dot" role="button" tabIndex={0} aria-label="Забележки на администрацията"
                          onClick={(e) => showTip(e, ADMIN_ROW, d)} onKeyDown={(e) => e.key === 'Enter' && showTip(e, ADMIN_ROW, d)} />
                      </li>
                    )}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
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

      {clearOpen && (
        <div className="modal-bg" onClick={() => setClearOpen(false)}>
          <form
            className="modal danger-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clr-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setClearOpen(false)}
            onSubmit={(e) => {
              e.preventDefault();
              if (clearText !== 'DELETE') return;
              setClearOpen(false);
              startTransition(async () => {
                const r = await clearMonth({ pharmacyId, year, month, confirmText: clearText });
                if (r?.error) alert(r.error);
                setLocal({});
                router.refresh();
              });
            }}
          >
            <h3 id="clr-title">Изчистване на месеца</h3>
            <p>
              Ще бъдат изтрити <b>всички смени</b> за {String(month).padStart(2, '0')}.{year} в <b>{pharmacyName}</b>. Действието е необратимо.
            </p>
            <label>
              <span>За потвърждение напишете <b>DELETE</b> с главни букви:</span>
              <input
                value={clearText}
                onChange={(e) => setClearText(e.target.value)}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="DELETE"
                aria-invalid={clearText !== '' && clearText !== 'DELETE'}
              />
            </label>
            {clearText !== '' && clearText !== 'DELETE' && <small className="err">Трябва да е точно DELETE (главни букви).</small>}
            <div className="inline">
              <button type="submit" className="btn danger-solid" disabled={clearText !== 'DELETE'}>Изтрий всички смени</button>
              <button type="button" className="btn" onClick={() => setClearOpen(false)}>Отказ</button>
            </div>
          </form>
        </div>
      )}

      {picker && (
        <div className="modal-bg" onClick={() => setPicker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{picker.name}</h3>
            <p className="muted">{picker.weekday}, {picker.day}.{String(month).padStart(2, '0')}.{year} · {pharmacyName}</p>
            {picker.elsewhere && <div className="alert">Има смяна в {picker.elsewhere} на тази дата. Изборът тук ще я премести в {pharmacyName}; „Изчисти“ ще я изтрие.</div>}
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
