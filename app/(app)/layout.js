import Link from 'next/link';
import { requireUser, can } from '@/lib/auth';
import { logout } from '../login/actions';
import Logo from '../components/Logo';
import NavLink from '../components/NavLink';

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const admin = [
    can(user, 'users.manage') && { href: '/admin/potrebiteli', label: 'Потребители' },
    can(user, 'pharmacies.manage') && { href: '/admin/apteki', label: 'Аптеки' },
    can(user, 'pharmacies.manage') && { href: '/admin/smeni', label: 'Типове смени' },
  ].filter(Boolean);

  return (
    <div className="shell">
      <header className="topbar no-print">
        <Link href="/grafik" className="brand">
          <Logo size={30} />
          <span>Пулс <small>графици</small></span>
        </Link>
        <nav className="nav">
          <NavLink href="/grafik">График</NavLink>
          <NavLink href="/zabelezhki">Забележки</NavLink>
          <NavLink href="/otpuski">Отпуски</NavLink>
          {admin.length > 0 && <span className="nav-sep" />}
          {admin.map((a) => <NavLink key={a.href} href={a.href}>{a.label}</NavLink>)}
        </nav>
        <div className="userbox">
          <Link href="/profil" className="username" title="Моят профил">
            {user.full_name}
            <small>{user.is_admin ? 'Администратор' : user.position || 'Служител'}</small>
          </Link>
          <form action={logout}><button className="btn ghost sm">Изход</button></form>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
