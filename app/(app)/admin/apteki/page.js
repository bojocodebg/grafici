import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import SubmitButton from '@/app/components/SubmitButton';
import { createPharmacy, updatePharmacy } from './actions';

export const metadata = { title: 'Аптеки – Пулс' };

export default async function PharmaciesPage() {
  await requirePermission('pharmacies.manage');
  const rows = await query(
    `SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.pharmacy_id = p.id AND u.active = 1) staff
       FROM pharmacies p ORDER BY p.active DESC, p.name`
  );
  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>Аптеки</h1><p className="muted">Обекти на веригата „Пулс“</p></div></div>
      <section className="card">
        <h2>Нова аптека</h2>
        <form action={createPharmacy} className="row-form">
          <input name="name" placeholder="Име *" required />
          <input name="address" placeholder="Адрес" />
          <input name="phone" placeholder="Телефон" />
          <SubmitButton>Добави</SubmitButton>
        </form>
      </section>
      <section className="card">
        <h2>Списък</h2>
        <div className="stack">
          {rows.map((p) => (
            <form key={p.id} action={updatePharmacy.bind(null, p.id)} className={`row-form ${p.active ? '' : 'dim'}`}>
              <input name="name" defaultValue={p.name} required />
              <input name="address" defaultValue={p.address || ''} placeholder="Адрес" />
              <input name="phone" defaultValue={p.phone || ''} placeholder="Телефон" />
              <label className="check"><input type="checkbox" name="active" defaultChecked={!!p.active} /> Активна</label>
              <span className="muted nowrap">{p.staff} служ.</span>
              <SubmitButton className="btn">Запиши</SubmitButton>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
