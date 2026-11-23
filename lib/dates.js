export const WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];

const pad = (n) => String(n).padStart(2, '0');

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (m && +m[2] >= 1 && +m[2] <= 12) return { year: +m[1], month: +m[2] };
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export const monthKey = (y, m) => `${y}-${pad(m)}`;

export function shiftMonth(y, m, delta) {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function monthDays(y, m) {
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    return { date: `${y}-${pad(m)}-${pad(day)}`, day, weekday: WEEKDAYS[wd], weekend: wd === 0 || wd === 6 };
  });
}

export function daysBetween(from, to) {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000) + 1;
}

export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateTime(s) {
  if (!s) return '';
  return `${fmtDate(s)} ${String(s).slice(11, 16)}`;
}

export const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');
