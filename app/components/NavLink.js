'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLink({ href, children }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + '/');
  return <Link href={href} className={active ? 'active' : ''}>{children}</Link>;
}
