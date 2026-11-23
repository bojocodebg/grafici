export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="10" fill="var(--brand)" />
      <path d="M19 10h10v9h9v10h-9v9H19v-9h-9V19h9z" fill="#fff" opacity=".95" />
      <path d="M8 26h8l3-6 4 12 3-8 2 2h12" stroke="var(--brand)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
