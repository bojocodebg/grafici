'use client';
import { useRef, useState } from 'react';

// Поле за дата, което винаги е във формат дд.мм.гггг (независимо от езика на браузъра).
// Към сървъра се изпраща скрито поле `name` с ISO стойност (гггг-мм-дд).
const toDisplay = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

function toIso(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!m) return '';
  const [, d, mo, y] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return '';
  return `${y}-${mo}-${d}`;
}

// Автоматично поставяне на точки докато се пише: 05112026 -> 05.11.2026
function mask(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '.' + digits.slice(2, 4);
  if (digits.length > 4) out += '.' + digits.slice(4, 8);
  return out;
}

export default function DateInput({ name, defaultValue = '', required = false }) {
  const [text, setText] = useState(toDisplay(defaultValue));
  const picker = useRef(null);
  const iso = toIso(text);

  function onText(e) {
    const prev = text;
    let v = e.target.value;
    // при изтриване не налагаме маската, за да може да се трие точката
    v = v.length < prev.length ? v : mask(v);
    setText(v);
    e.target.setCustomValidity(v && !toIso(v) ? 'Въведете валидна дата във формат дд.мм.гггг' : '');
  }

  return (
    <span className="date-input">
      <input
        type="text"
        inputMode="numeric"
        placeholder="дд.мм.гггг"
        value={text}
        onChange={onText}
        onBlur={(e) => e.target.setCustomValidity(text && !iso ? 'Въведете валидна дата във формат дд.мм.гггг' : '')}
        onInvalid={(e) => { if (!text) e.target.setCustomValidity('Изберете дата (дд.мм.гггг).'); }}
        onInput={(e) => { if (!e.target.value) e.target.setCustomValidity(''); }}
        required={required}
        pattern="\d{2}\.\d{2}\.\d{4}"
        title="Формат: дд.мм.гггг"
        maxLength={10}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={iso} />
      <button
        type="button"
        className="date-btn"
        aria-label="Избери от календар"
        title="Избери от календар"
        onClick={() => { try { picker.current.showPicker(); } catch { picker.current.focus(); } }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      <input
        ref={picker}
        type="date"
        className="date-native"
        tabIndex={-1}
        aria-hidden="true"
        value={iso}
        onChange={(e) => { setText(toDisplay(e.target.value)); }}
      />
    </span>
  );
}
