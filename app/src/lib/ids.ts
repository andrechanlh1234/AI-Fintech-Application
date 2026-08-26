let seq = 1000;

export function uid(): string {
  return 'id' + seq++;
}

/** Bumps the counter forward (never backward) so ids minted from here on
 * can't land below one already seen -- see seedUidFromPersisted below for
 * why this is needed. */
export function ensureUidAbove(n: number): void {
  if (n >= seq) seq = n + 1;
}

// Every id this app mints is exactly 'id' + a number (see uid() above),
// optionally with a literal prefix in front (e.g. 'rcpt-tx-id1042',
// 'rcpt-id7'). `seq` is in-memory only and resets to 1000 on every fresh
// page load, while ids it already minted live on indefinitely in
// localStorage (and, once signed in, the backend) -- without this, a new
// session's counter restarting at 1000 will eventually re-mint an id a
// past session already used and gave to a *different* record, corrupting
// whichever one a later action (edit, delete, a React list key) resolves
// by that id. Called with the persisted/remote payload before it's merged
// into state, this walks it for every trailing '...id<N>' string and
// advances the counter past the highest N found, so newly minted ids are
// always fresh relative to everything already on record -- without having
// to separately hand-maintain a list of every id-bearing field.
const TRAILING_ID_RE = /id(\d+)$/;

export function seedUidFromPersisted(value: unknown, seen: Set<unknown> = new Set()): void {
  if (typeof value === 'string') {
    const m = TRAILING_ID_RE.exec(value);
    if (m) ensureUidAbove(Number(m[1]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return; // guards against unexpected cycles
  seen.add(value);
  for (const v of Object.values(value as Record<string, unknown>)) {
    seedUidFromPersisted(v, seen);
  }
}
