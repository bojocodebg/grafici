// Системни настройки. Използва се и от proxy.js (Node.js runtime), затова без 'server-only'.
import { query } from './db';

export const SETTINGS = {
  session_timeout_minutes: { label: 'Автоматичен изход след неактивност (минути)', def: 30, min: 5, max: 1440 },
  session_warning_seconds: { label: 'Предупреждение преди изхода (секунди)', def: 60, min: 15, max: 600 },
};

// Кратък кеш в паметта, за да не се чете базата при всяка заявка
const CACHE_MS = 15_000;
const g = globalThis;
g.__pulsSettings ??= { at: 0, values: null };

function clamp(name, raw) {
  const s = SETTINGS[name];
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return s.def;
  return Math.min(s.max, Math.max(s.min, n));
}

export async function getSettings() {
  const c = g.__pulsSettings;
  if (c.values && Date.now() - c.at < CACHE_MS) return c.values;
  const values = Object.fromEntries(Object.entries(SETTINGS).map(([k, s]) => [k, s.def]));
  try {
    const rows = await query('SELECT name, value FROM settings');
    for (const r of rows) if (r.name in SETTINGS) values[r.name] = clamp(r.name, r.value);
  } catch (e) {
    console.error('Настройките не могат да бъдат прочетени – използват се стойностите по подразбиране:', e.message);
  }
  g.__pulsSettings = { at: Date.now(), values };
  return values;
}

export async function saveSettings(values) {
  const clean = {};
  for (const name of Object.keys(SETTINGS)) {
    if (!(name in values)) continue;
    clean[name] = clamp(name, values[name]);
    await query('INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, String(clean[name])]);
  }
  g.__pulsSettings = { at: 0, values: null };
  return clean;
}

// Сървърът дава малко повече време от браузъра, защото браузърът съобщава
// за активност най-много веднъж в минута (виж SessionTimer).
export const SERVER_GRACE_SECONDS = 120;
