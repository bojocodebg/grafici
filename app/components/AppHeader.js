'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FullLogo } from './Logo';
import { grafikHref } from './RememberGrafik';

// Заглавна лента: на широк екран менюто е в реда; на тесен – сгъва се зад бутон „☰“.
export default function AppHeader({ main, admin, user, logout }) {
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false); // падащото меню „Администрация“ (на компютър)
  const adminRef = useRef(null);
  const path = usePathname();
  useEffect(() => { setOpen(false); setAdminOpen(false); }, [path]);
  useEffect(() => {
    if (!open && !adminOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setAdminOpen(false); } };
    const onClick = (e) => { if (adminRef.current && !adminRef.current.contains(e.target)) setAdminOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onClick); };
  }, [open, adminOpen]);
  // „График“ води към последно избрания месец/аптека
  const router = useRouter();
  const [gHref, setGHref] = useState('/grafik');
  useEffect(() => { setGHref(grafikHref()); }, [path]);
  // при натискане четем запомнения месец наново (може да е сменен със „Следващ“ на същата страница)
  const goGrafik = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(false);
    router.push(grafikHref());
  };
  const adminActive = admin.some((l) => path === l.href || path.startsWith(l.href + '/'));

  const link = (l) => {
    const active = path === l.href || path.startsWith(l.href + '/');
    const isG = l.href === '/grafik';
    return <Link key={l.href} href={isG ? gHref : l.href} onClick={isG ? goGrafik : undefined} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{l.label}</Link>;
  };

  return (
    <header className={`topbar no-print ${open ? 'open' : ''}`}>
      <div className="topbar-row">
        <Link href={gHref} onClick={goGrafik} className="brand">
          <FullLogo height={38} />
          <span className="brand-sub">графици</span>
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
          <div className="nav-group admin-group" ref={adminRef}>
            <span className="nav-title">Администрация</span>
            <button
              type="button"
              className={`admin-toggle ${adminActive ? 'active' : ''}`}
              aria-expanded={adminOpen}
              aria-controls="admin-links"
              onClick={() => setAdminOpen((o) => !o)}
            >
              Администрация <span aria-hidden="true" className="caret">▾</span>
            </button>
            <div id="admin-links" className={`admin-links ${adminOpen ? 'show' : ''}`}>{admin.map(link)}</div>
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
