'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

// Заглавна лента: на широк екран менюто е в реда; на тесен – сгъва се зад бутон „☰“.
export default function AppHeader({ main, admin, user, logout }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const link = (l) => {
    const active = path === l.href || path.startsWith(l.href + '/');
    return <Link key={l.href} href={l.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{l.label}</Link>;
  };

  return (
    <header className={`topbar no-print ${open ? 'open' : ''}`}>
      <div className="topbar-row">
        <Link href="/grafik" className="brand">
          <Logo size={30} />
          <span>Пулс <small>графици</small></span>
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? 'Затвори менюто' : 'Отвори менюто'}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true" className="burger"><i /><i /><i /></span>
        </button>
      </div>
      <nav id="main-nav" className="nav" aria-label="Основно меню">
        <div className="nav-group">{main.map(link)}</div>
        {admin.length > 0 && (
          <div className="nav-group admin-group">
            <span className="nav-title">Администрация</span>
            {admin.map(link)}
          </div>
        )}
      </nav>
      <div className="userbox">
        <Link href="/profil" className="username" title="Моят профил">
          <span className="avatar" aria-hidden="true">{user.initials}</span>
          <span className="uname">
            {user.name}
            <small>{user.role}</small>
          </span>
        </Link>
        <form action={logout}><button className="btn ghost sm">Изход</button></form>
      </div>
    </header>
  );
}
