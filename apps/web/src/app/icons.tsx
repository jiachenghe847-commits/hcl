/** Icons and the mood face, ported from the prototype's inline SVGs. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

export const Icon = {
  logo: (p: P) => (
    <svg viewBox="0 0 32 32" aria-hidden {...p}>
      <path d="M6 17c0-6 4.5-11 10-11s10 5 10 11" fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M10 26v-7h12v7" fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinejoin="round" />
      <circle cx="16" cy="14" r="2.6" fill="var(--m4)" />
    </svg>
  ),
  back: (p: P) => (
    <svg {...base} {...p}>
      <path d="M15 5l-7 7 7 7" {...stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chev: (p: P) => (
    <svg {...base} width={20} height={20} {...p}>
      <path d="M9 5l7 7-7 7" {...stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  home: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" {...stroke} strokeLinejoin="round" />
    </svg>
  ),
  mood: (p: P) => (
    <svg {...base} {...p}>
      <path d="M3 17l5-6 4 3 4-6 5 7" {...stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  book: (p: P) => (
    <svg {...base} {...p}>
      <rect x="4" y="5" width="16" height="15" rx="2" {...stroke} />
      <path d="M4 10h16M9 3v4M15 3v4" {...stroke} strokeLinecap="round" />
    </svg>
  ),
  me: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="9" r="4" {...stroke} />
      <path d="M4 20c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5" {...stroke} strokeLinecap="round" />
    </svg>
  ),
  sos: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3l9 16H3z" {...stroke} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M12 10v4M12 17v.5" {...stroke} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  ),
  phone: (p: P) => (
    <svg {...base} {...p}>
      <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" {...stroke} strokeLinejoin="round" />
    </svg>
  ),
  lock: (p: P) => (
    <svg {...base} {...p}>
      <rect x="5" y="10" width="14" height="10" rx="2" {...stroke} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" {...stroke} />
    </svg>
  ),
  eye: (p: P) => (
    <svg {...base} {...p}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...stroke} />
      <circle cx="12" cy="12" r="3" {...stroke} />
    </svg>
  ),
  shield: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...stroke} strokeLinejoin="round" />
      <path d="M8.5 12l2.5 2.5 4.5-5" {...stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 11v6M12 7.5v.5" {...stroke} strokeLinecap="round" />
    </svg>
  ),
  wind: (p: P) => (
    <svg {...base} {...p}>
      <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3" {...stroke} strokeLinecap="round" />
    </svg>
  ),
  check: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="10" fill="var(--accent-soft)" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const MOUTHS: Record<number, string> = { 1: 'M14 31q8-6 16 0', 2: 'M15 30q7-3 14 0', 3: 'M15 29h14', 4: 'M15 28q7 4 14 0', 5: 'M14 27q8 7 16 0' };

export function Face({ level, size = 44 }: { level: number; size?: number }) {
  return (
    <svg className="face" viewBox="0 0 44 44" width={size} height={size} aria-hidden>
      <circle cx="22" cy="22" r="21" fill={`var(--m${level})`} />
      <circle cx="16" cy="19" r="2.2" fill="var(--card)" />
      <circle cx="28" cy="19" r="2.2" fill="var(--card)" />
      <path d={MOUTHS[level]} fill="none" stroke="var(--card)" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}

export function Bars({ n }: { n: number }) {
  return (
    <span className="bars" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  );
}
