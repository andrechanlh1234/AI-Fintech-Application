/** Two-tone budget utilisation bar: darker green = spent, lighter green =
 * remaining, with a circular marker at the spent/remaining boundary.
 * `pct` is the TRUE, uncapped utilisation (selectors.ts never clamps it) --
 * callers that show it as text (e.g. the "{pct}% Utilised" figure next to
 * this bar) can read e.g. "112%" on an overspent month rather than silently
 * reporting back "100%". `barPct` is the same value clamped to [0,100]
 * purely for the bar's own CSS width -- the fill can never exceed its
 * track. */
export function BudgetUtilisationBar({ pct, barPct }: { pct: number; barPct: number }) {
  const over = pct > 100;
  const fillColor = over ? 'var(--color-danger)' : 'var(--color-accent-700)';

  return (
    <div style={{ position: 'relative' }}>
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
