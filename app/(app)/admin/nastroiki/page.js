import { requireAdmin } from '@/lib/auth';
import { getSettings, SETTINGS } from '@/lib/settings';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { updateSettings } from './actions';

export const metadata = { title: 'Настройки – Пулс' };

const PRESETS = [15, 30, 60, 120, 240, 480];
const human = (m) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

export default async function SettingsPage({ searchParams }) {
  const sp = await searchParams;
  await requireAdmin();
  const s = await getSettings();
  const t = SETTINGS.session_timeout_minutes, w = SETTINGS.session_warning_seconds;

  return (
    <div className="stack-lg narrow">
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p className="muted">Системни настройки – достъпни само за администратор.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <form action={updateSettings} className="card stack">
        <h2>Сесия и сигурност</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Ако потребителят не прави нищо (мишка, клавиатура, докосване) за зададеното време, системата го извежда автоматично.
          Малко преди това се показва предупреждение с обратно броене и бутон „Продължи работа“.
          Отворените раздели на един браузър се синхронизират – активност в единия удължава сесията и в другите.
        </p>
        <label>{t.label}
          <input name="session_timeout_minutes" type="number" min={t.min} max={t.max} step="1" defaultValue={s.session_timeout_minutes} required list="timeout-presets" />
          <datalist id="timeout-presets">{PRESETS.map((m) => <option key={m} value={m}>{human(m)}</option>)}</datalist>
          <small className="muted">От {t.min} до {t.max} минути (24 ч). Текущо: {human(s.session_timeout_minutes)}.</small>
        </label>
        <label>{w.label}
          <input name="session_warning_seconds" type="number" min={w.min} max={w.max} step="5" defaultValue={s.session_warning_seconds} required />
          <small className="muted">От {w.min} до {w.max} секунди.</small>
        </label>
        <p className="muted small" style={{ marginTop: 0 }}>Промяната важи за всички потребители до около 15 секунди, без да е нужно да влизат отново.</p>
        <div><SubmitButton>Запази</SubmitButton></div>
      </form>
    </div>
  );
}
