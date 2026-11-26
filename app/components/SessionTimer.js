'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { sessionExpired, logout } from '../login/actions';

const KEY = 'puls-last-activity'; // общо за всички раздели на браузъра
const PING_EVERY = 60_000;        // съобщаваме на сървъра за активност най-много веднъж в минута
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'];

const readShared = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const writeShared = (t) => { try { localStorage.setItem(KEY, String(t)); } catch {} };
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Автоматичен изход след неактивност.
 * timeout и warning са в секунди (идват от настройките на администратора).
 */
export default function SessionTimer({ timeout, warning }) {
  const [left, setLeft] = useState(null); // секунди до изхода, когато се показва предупреждението
  const cfg = useRef({ timeout, warning });
  const last = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const expiring = useRef(false);
  const warnOpen = useRef(false);
  const path = usePathname();

  cfg.current = { timeout, warning };

  async function ping() {
    lastPing.current = Date.now();
    try {
      const r = await fetch('/api/session/ping', { method: 'POST', cache: 'no-store' });
      if (r.status === 401) return goLogin();
      const j = await r.json();
      if (j.timeout) cfg.current = { timeout: j.timeout, warning: j.warning }; // ако администраторът е сменил настройката
    } catch { /* без връзка – ще опитаме при следваща активност */ }
  }

  function goLogin() {
    if (expiring.current) return;
    expiring.current = true;
    window.location.href = '/login?expired=1';
  }

  async function expire() {
    if (expiring.current) return;
    try { await sessionExpired(); } catch {}
    goLogin();
  }

  function activity(force = false) {
    if (warnOpen.current && !force) return; // докато е отворено предупреждението, удължава само бутонът
    const now = Date.now();
    last.current = now;
    if (now - readShared() > 2000) writeShared(now);
    if (force || now - lastPing.current > PING_EVERY) ping();
  }

  // Смяна на страница = активност (и сървърът вече е подновил сесията)
  useEffect(() => { last.current = Date.now(); lastPing.current = Date.now(); writeShared(Date.now()); }, [path]);

  useEffect(() => {
    let t = 0;
    const onAct = () => { const n = Date.now(); if (n - t > 1000) { t = n; activity(); } };
    EVENTS.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const timer = setInterval(() => {
      const { timeout: to, warning: w } = cfg.current;
      const lastAny = Math.max(last.current, readShared());
      const remaining = Math.ceil((lastAny + to * 1000 - Date.now()) / 1000);
      if (remaining <= 0) { expire(); return; }
      if (remaining <= w) { warnOpen.current = true; setLeft(remaining); }
      else if (warnOpen.current) { warnOpen.current = false; setLeft(null); } // удължено от друг раздел
    }, 1000);
    return () => { EVENTS.forEach((e) => window.removeEventListener(e, onAct)); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (left === null) return null;
  return (
    <div className="modal-bg session-bg" role="alertdialog" aria-modal="true" aria-labelledby="st-title" aria-describedby="st-desc">
      <div className="modal session-modal">
        <h3 id="st-title">Сесията изтича</h3>
        <p id="st-desc">Поради неактивност ще бъдете изведени от системата след</p>
        <div className="session-count" aria-live="polite">{fmt(left)}</div>
        <div className="inline">
          <button type="button" className="btn primary" autoFocus onClick={() => { warnOpen.current = false; setLeft(null); activity(true); }}>
            Продължи работа
          </button>
          <form action={logout}><button className="btn">Изход</button></form>
        </div>
      </div>
    </div>
  );
}
