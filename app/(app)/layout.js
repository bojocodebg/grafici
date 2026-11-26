import { requireUser, can } from '@/lib/auth';
import { logout } from '../login/actions';
import AppHeader from '../components/AppHeader';
import SessionTimer from '../components/SessionTimer';
import { getSettings } from '@/lib/settings';
import { TIMEOUT_USERNAME } from '@/lib/session';

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const main = [
    { href: '/grafik', label: 'График' },
    { href: '/zabelezhki', label: 'Забележки' },
    { href: '/otpuski', label: 'Отпуски' },
  ];
  const admin = [
    can(user, 'users.manage') && { href: '/admin/potrebiteli', label: 'Потребители' },
    can(user, 'pharmacies.manage') && { href: '/admin/apteki', label: 'Аптеки' },
    can(user, 'pharmacies.manage') && { href: '/admin/dlazhnosti', label: 'Длъжности' },
    can(user, 'pharmacies.manage') && { href: '/admin/smeni', label: 'Типове смени' },
    can(user, 'audit.view') && { href: '/admin/zhurnal', label: 'Журнал' },
    user.is_admin && { href: '/admin/nastroiki', label: 'Настройки' },
  ].filter(Boolean);
  const settings = await getSettings();
  const initials = user.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <AppHeader
        main={main}
        admin={admin}
        user={{ name: user.full_name, role: user.is_admin ? 'Администратор' : user.position || 'Служител', initials }}
        logout={logout}
      />
      <main className="content">{children}</main>
      {user.username === TIMEOUT_USERNAME && (
        <SessionTimer timeout={settings.session_timeout_minutes * 60} warning={settings.session_warning_seconds} />
      )}
    </div>
  );
}
