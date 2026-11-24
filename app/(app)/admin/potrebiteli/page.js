import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { query } from '@/lib/db';
import { PERMISSIONS } from '@/lib/permissions';
import Flash from '@/app/components/Flash';

export const metadata = { title: 'Потребители – Пулс' };

export default async function UsersPage({ searchParams }) {
  const sp = await searchParams;
  await requirePermission('users.manage');
  const users = await query(
    `SELECT u.id, u.username, u.full_name, pos.name position, u.is_admin, u.active, p.name pharmacy,
            GROUP_CONCAT(up.permission) perms
       FROM users u LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
       LEFT JOIN positions pos ON pos.id = u.position_id
       LEFT JOIN user_permissions up ON up.user_id = u.id
      GROUP BY u.id ORDER BY u.active DESC, p.name, u.full_name`
  );
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div><h1>Потребители</h1><p className="muted">Служители, достъп и права</p></div>
        <Link className="btn primary" href="/admin/potrebiteli/nov">+ Нов потребител</Link>
      </div>
      <Flash sp={sp} />
      <div className="card table-wrap">
        <table className="table cards">
          <thead><tr><th>Име</th><th>Потребител</th><th>Длъжност</th><th>Аптека</th><th>Права</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'dim'}>
                <td data-label="Име"><b>{u.full_name}</b></td>
                <td data-label="Потребител">{u.username}</td>
                <td data-label="Длъжност">{u.position || '—'}</td>
                <td data-label="Аптека">{u.pharmacy || <span className="muted">—</span>}</td>
                <td data-label="Права">
                  {u.is_admin ? <span className="badge ok">Администратор</span>
                    : u.perms ? u.perms.split(',').map((p) => <span key={p} className="badge" title={PERMISSIONS[p]}>{PERMISSIONS[p] || p}</span>)
                    : <span className="muted">Служител</span>}
                </td>
                <td data-label="Статус">{u.active ? <span className="badge ok">Активен</span> : <span className="badge bad">Неактивен</span>}</td>
                <td className="actions-cell"><Link className="btn sm" href={`/admin/potrebiteli/${u.id}`}>Редакция</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
