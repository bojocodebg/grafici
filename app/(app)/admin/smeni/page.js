import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { fmtTime } from '@/lib/dates';
import SubmitButton from '@/app/components/SubmitButton';
import { createShiftType, updateShiftType } from './actions';

export const metadata = { title: 'Типове смени – Пулс' };

function Fields({ t = {}, nextOrder = 0 }) {
  return (
    <>
      <label className="tiny" title="Индекс за подредба – по-малкото число е по-напред">ред<input name="sort_order" type="number" step="1" defaultValue={t.sort_order ?? nextOrder} className="w-num" /></label>
      <input name="code" defaultValue={t.code} placeholder="Код" maxLength={5} required className="w-code" />
      <input name="name" defaultValue={t.name} placeholder="Наименование *" required />
      <label className="tiny">от<input type="time" name="start_time" defaultValue={fmtTime(t.start_time)} /></label>
      <label className="tiny">до<input type="time" name="end_time" defaultValue={fmtTime(t.end_time)} /></label>
      <label className="tiny">часа<input name="hours" type="number" step="0.5" min="0" max="24" defaultValue={t.hours != null ? Number(t.hours) : 8} className="w-num" /></label>
      <input type="color" name="color" defaultValue={t.color || '#4caf50'} />
    </>
  );
}

export default async function ShiftTypesPage() {
  await requirePermission('pharmacies.manage');
  const rows = await query('SELECT * FROM shift_types ORDER BY active DESC, sort_order, id');
  const nextOrder = rows.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>Типове смени</h1><p className="muted">Използват се при попълване на графика. Неактивните не се предлагат за нови смени. Полето „ред“ определя подредбата в графика, легендата и обобщението на часовете (по-малкото число е по-напред).</p></div></div>
      <section className="card">
        <h2>Нов тип</h2>
        <form action={createShiftType} className="row-form"><Fields nextOrder={nextOrder} /><SubmitButton>Добави</SubmitButton></form>
      </section>
      <section className="card">
        <h2>Списък</h2>
        <div className="stack">
          {rows.map((t) => (
            <form key={t.id} action={updateShiftType.bind(null, t.id)} className={`row-form ${t.active ? '' : 'dim'}`}>
              <Fields t={t} />
              <label className="check"><input type="checkbox" name="active" defaultChecked={!!t.active} /> Активен</label>
              <SubmitButton className="btn">Запиши</SubmitButton>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
