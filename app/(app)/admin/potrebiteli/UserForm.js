import Link from 'next/link';
import { PERMISSIONS } from '@/lib/permissions';
import SubmitButton from '@/app/components/SubmitButton';

export default function UserForm({ action, user = {}, perms = [], pharmacies, positions, isNew, canGrantAdmin, nextOrder = 10 }) {
  return (
    <form action={action} className="stack-lg">
      <section className="card">
        <h2>Данни</h2>
        <div className="form-grid">
          <label>Име и фамилия *<input name="full_name" defaultValue={user.full_name} required /></label>
          <label>Потребителско име *<input name="username" defaultValue={user.username} required pattern="[a-zA-Z0-9._\-]{3,60}" /></label>
          <label>Длъжност
            <select name="position_id" defaultValue={user.position_id || ''}>
              <option value="">— без длъжност —</option>
              {positions.filter((p) => p.active || p.id === user.position_id).map((p) => (
                <option key={p.id} value={p.id}>{p.name}{!p.active ? ' (неактивна)' : ''}</option>
              ))}
            </select>
          </label>
          <label title="Без аптека – служителят може да получава смени във всички аптеки">Аптека
            <select name="pharmacy_id" defaultValue={user.pharmacy_id || ''}>
              <option value="">— без аптека (всички аптеки) —</option>
              {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}{!p.active ? ' (неактивна)' : ''}</option>)}
            </select>
          </label>
          <label title="По-малкото число е по-напред в графика">Ред в графика
            <input name="sort_order" type="number" step="1" defaultValue={user.sort_order ?? nextOrder} />
          </label>
          <label>Телефон<input name="phone" defaultValue={user.phone || ''} /></label>
          <label>Имейл<input name="email" type="email" defaultValue={user.email || ''} /></label>
          <label>{isNew ? 'Парола *' : 'Нова парола (оставете празно, за да не се сменя)'}
            <input name="password" type="password" minLength={6} required={isNew} autoComplete="new-password" />
          </label>
          <label className="check"><input type="checkbox" name="active" defaultChecked={isNew || !!user.active} /> Активен профил</label>
          <label className="check" title="Изключете за служебни акаунти, които не работят смени (напр. admin)">
            <input type="checkbox" name="show_in_schedule" defaultChecked={isNew || !!user.show_in_schedule} /> Участва в графиците (може да получава смени)
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Права</h2>
        <p className="muted">Всеки активен потребител може да вижда графика на своята аптека, да пише забележки и да подава заявки за отпуск – без да може да ги променя. Допълнителни права:</p>
        <div className="perm-list">
          {canGrantAdmin && (
            <label className="check perm admin">
              <input type="checkbox" name="is_admin" defaultChecked={!!user.is_admin} />
              <span><b>Администратор</b><small>Пълен достъп до всички функции</small></span>
            </label>
          )}
          {Object.entries(PERMISSIONS).map(([k, label]) => (
            <label key={k} className="check perm">
              <input type="checkbox" name="permissions" value={k} defaultChecked={perms.includes(k)} />
              <span>{label}<small>{k}</small></span>
            </label>
          ))}
        </div>
      </section>

      <div className="inline">
        <SubmitButton>{isNew ? 'Създай потребител' : 'Запиши промените'}</SubmitButton>
        <Link className="btn" href="/admin/potrebiteli">Назад</Link>
      </div>
    </form>
  );
}
