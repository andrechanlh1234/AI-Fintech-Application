import { moneyWhole } from '../lib/format';

/** Two-tone budget utilisation bar: darker green = spent, lighter green =
 * remaining, with a circular marker at the spent/remaining boundary
 * carrying an always-visible "{pct}% Utilised" label. `pct` is the TRUE,
 * uncapped utilisation (selectors.ts never clamps it) so this is the one
 * place overspend actually shows as >100% rather than silently reading
 * back as "100%". `barPct` is the same value clamped to [0,100] purely for
 * the bar's own CSS width -- the fill can never exceed its track.
 *
 * The label sits in a fixed reserved band above the bar and clamps its
 * horizontal position within the track, so it never collides with the
 * marker or clips off either edge -- the same lesson as the Net Worth
 * chart's tooltip. */
export function BudgetUtilisationBar({ pct, barPct, spent, cap }: { pct: number; barPct: number; spent: number; cap: number }) {
  const over = pct > 100;
  const overAmount = Math.max(0, spent - cap);
  const fillColor = over ? 'var(--color-danger)' : 'var(--color-accent-700)';
  // The label follows the marker but never gets closer than 18% to either
  // edge of the track, so at 0% or 100% utilisation the text still reads
  // fully inside the card instead of clipping.
  const labelLeftPct = Math.min(82, Math.max(18, barPct));

  return (
    <div style={{ position: 'relative', paddingTop: 22 }}>
      <div
        className="type-numeric"
        style={{
          position: 'absolute', top: 0, left: `${labelLeftPct}%`, transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 700, color: over ? 'var(--color-danger-700)' : 'var(--color-accent-700)',
        }}
      >
        {pct}% Utilised{over && ` · RM ${moneyWhole(overAmount)} over`}
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--color-accent-100)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, width: `${barPct}%`, background: fillColor, borderRadius: 999,
            transition: 'width .4s cubic-bezier(.16,1,.3,1), background .2s ease',
          }}
        />
        <div
          style={{
            position: 'absolute', top: '50%', left: `${barPct}%`, width: 14, height: 14, borderRadius: '50%',
            background: fillColor, border: '2.5px solid var(--color-surface)', boxSizing: 'border-box',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transform: 'translate(-50%, -50%)',
            transition: 'left .4s cubic-bezier(.16,1,.3,1), background .2s ease',
          }}
        />
      </div>
    </div>
  );
}
