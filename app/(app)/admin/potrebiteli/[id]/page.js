import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import Flash from '@/app/components/Flash';
import SubmitButton from '@/app/components/SubmitButton';
import UserForm from '../UserForm';
import { createUser, updateUser, deleteUser } from '../actions';

export default async function UserEditPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requirePermission('users.manage');
  const pharmacies = await query('SELECT id, name, active FROM pharmacies ORDER BY name');
  const positions = await query('SELECT id, name, active FROM positions ORDER BY sort_order, name');

  if (id === 'nov') {
    return (
      <div className="stack-lg">
        <h1>Нов потребител</h1>
        <Flash sp={sp} />
        <UserForm action={createUser} pharmacies={pharmacies} positions={positions} isNew canGrantAdmin={me.is_admin} />
      </div>
    );
  }

  const uid = Number(id);
  const [user] = await query('SELECT * FROM users WHERE id = ?', [uid]);
  if (!user) notFound();
  const perms = (await query('SELECT permission FROM user_permissions WHERE user_id = ?', [uid])).map((p) => p.permission);
  const [{ shifts }] = await query('SELECT COUNT(*) shifts FROM shifts WHERE user_id = ?', [uid]);
  const inSchedule = shifts > 0;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>{user.full_name}</h1>
        {uid !== me.id && (
          <form action={deleteUser.bind(null, uid)}>
            {inSchedule ? (
              // Изключеният бутон не реагира на мишката, затова балонът е върху обвивката
              <span className="tip-wrap" tabIndex={0} data-tip="Потребителят не може да бъде изтрит, понеже присъства в графиците">
                <button type="button" className="btn danger" disabled aria-describedby="del-tip">Изтрий</button>
                <span id="del-tip" className="sr-only">Потребителят не може да бъде изтрит, понеже присъства в графиците</span>
              </span>
            ) : (
              <SubmitButton className="btn danger" confirm="Изтриване на потребителя заедно с неговите забележки и отпуски? (За напуснали служители е по-добре да деактивирате профила.)">Изтрий</SubmitButton>
            )}
          </form>
        )}
      </div>
      <Flash sp={sp} />
      <UserForm action={updateUser.bind(null, uid)} user={user} perms={perms} pharmacies={pharmacies} positions={positions} canGrantAdmin={me.is_admin} />
    </div>
  );
}
