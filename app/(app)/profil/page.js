import { requireUser } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import { changePassword } from './actions';

export const metadata = { title: 'Профил – Пулс' };

export default async function ProfilePage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  return (
    <div className="stack-lg narrow">
      <h1>Моят профил</h1>
      <Flash sp={sp} />
      <section className="card">
        <dl className="dl">
          <dt>Име</dt><dd>{user.full_name}</dd>
          <dt>Потребител</dt><dd>{user.username}</dd>
          <dt>Длъжност</dt><dd>{user.position || '—'}</dd>
          <dt>Аптека</dt><dd>{user.pharmacy_name || '—'}</dd>
          <dt>Права</dt>
          <dd>
            {user.is_admin ? 'Администратор (пълен достъп)' : (
              <ul className="plain">
                <li>Преглед на графика, забележки, заявки за отпуск</li>
                {user.permissions.map((p) => <li key={p}>{PERMISSIONS[p]}</li>)}
              </ul>
            )}
          </dd>
        </dl>
      </section>
      <section className="card">
        <h2>Смяна на парола</h2>
        <form action={changePassword} className="stack">
          <label>Текуща парола<input type="password" name="current" required autoComplete="current-password" /></label>
          <label>Нова парола<input type="password" name="next" required minLength={6} autoComplete="new-password" /></label>
          <label>Повторете новата парола<input type="password" name="confirm" required minLength={6} autoComplete="new-password" /></label>
          <div><SubmitButton>Смени паролата</SubmitButton></div>
        </form>
      </section>
    </div>
  );
}
