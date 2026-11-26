'use client';
import { useEffect } from 'react';

// Записва показания в графика месец и аптека, за да се върне към тях след друга операция.
// Изпълнява се само когато страницата наистина се покаже (не и при предварително зареждане).
export const GRAFIK_M = 'puls_grafik_m';
export const GRAFIK_A = 'puls_grafik_a';
const YEAR = 60 * 60 * 24 * 365;

export function readGrafikMemory() {
  if (typeof document === 'undefined') return {};
  const get = (n) => document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1];
  const m = get(GRAFIK_M), a = get(GRAFIK_A);
  return { m: /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '') ? m : null, a: /^\d{1,9}$/.test(a || '') ? a : null };
}

export function grafikHref() {
  const { m, a } = readGrafikMemory();
  if (!m) return '/grafik';
  return `/grafik?m=${m}${a ? `&a=${a}` : ''}`;
}

export default function RememberGrafik({ m, a }) {
  useEffect(() => {
    document.cookie = `${GRAFIK_M}=${m}; path=/; max-age=${YEAR}; samesite=lax`;
    if (a) document.cookie = `${GRAFIK_A}=${a}; path=/; max-age=${YEAR}; samesite=lax`;
  }, [m, a]);
  return null;
}
