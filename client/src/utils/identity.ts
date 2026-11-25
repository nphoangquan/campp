import type { CSSProperties } from 'react';

const POOL = 6;

/** Stable 0..POOL-1 bucket for a user id, so a person keeps one colour everywhere. */
export function identityIndex(id: string | undefined | null): number {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % POOL;
}

/** The person's name colour; theme-aware through --id-N, or tuned for the black band. */
export function identityColor(id: string | undefined | null, onBand = false): string {
  return `var(--${onBand ? 'idb' : 'id'}-${identityIndex(id)})`;
}

/** Inline style for a name rendered in the person's colour. */
export function nameStyle(id: string | undefined | null): CSSProperties {
  return { color: identityColor(id) };
}

/** Quiet avatar tile: a tint of the identity colour with the initial in full colour. */
export function avatarStyle(id: string | undefined | null): CSSProperties {
  const c = identityColor(id);
  return { backgroundColor: `color-mix(in oklab, ${c} 16%, var(--surface))`, color: c };
}
