import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { createPosition, updatePosition, deletePosition } from './actions';

export const metadata = { title: 'Длъжности – Пулс' };

export default async function PositionsPage({ searchParams }) {
  const sp = await searchParams;
  await requirePermission('pharmacies.manage');
  const rows = await query(
    `SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.position_id = p.id) users
       FROM positions p ORDER BY p.active DESC, p.sort_order, p.name`
  );
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Длъжности</h1>
          <p className="muted">Длъжностите се избират в профила на всеки служител. Служителите с длъжност „Във всички аптеки“ (напр. управител) и тези без зачислена аптека могат да получават смени във всяка аптека.</p>
        </div>
      </div>
      <Flash sp={sp} />
      <section className="card">
        <h2>Нова длъжност</h2>
        <form action={createPosition} className="row-form">
          <input name="name" placeholder="Наименование *" required maxLength={100} />
          <label className="tiny">ред<input name="sort_order" type="number" defaultValue={0} className="w-num" /></label>
          <label className="check" title="Служителите с тази длъжност могат да получават смени във всички аптеки"><input type="checkbox" name="all_pharmacies" /> Във всички аптеки</label>
          <SubmitButton>Добави</SubmitButton>
        </form>
      </section>
      <section className="card">
        <h2>Списък</h2>
        {rows.length === 0 && <p className="muted">Няма въведени длъжности.</p>}
        <div className="stack">
          {rows.map((p) => (
            <div key={p.id} className={`row-form ${p.active ? '' : 'dim'}`}>
              <form action={updatePosition.bind(null, p.id)} className="row-form grow">
                <input name="name" defaultValue={p.name} required maxLength={100} />
                <label className="tiny">ред<input name="sort_order" type="number" defaultValue={p.sort_order} className="w-num" /></label>
                <label className="check" title="Служителите с тази длъжност могат да получават смени във всички аптеки"><input type="checkbox" name="all_pharmacies" defaultChecked={!!p.all_pharmacies} /> Във всички аптеки</label>
                <label className="check"><input type="checkbox" name="active" defaultChecked={!!p.active} /> Активна</label>
                <span className="muted nowrap">{p.users} служ.</span>
                <SubmitButton className="btn">Запиши</SubmitButton>
              </form>
              <form action={deletePosition.bind(null, p.id)}>
                <SubmitButton
                  className="btn danger"
                  disabled={p.users > 0}
                  title={p.users > 0 ? 'Използва се от служители – може само да се деактивира' : 'Изтрий'}
                  confirm={`Изтриване на длъжност „${p.name}“?`}
                >Изтрий</SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
