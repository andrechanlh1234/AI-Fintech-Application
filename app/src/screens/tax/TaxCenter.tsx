import { useStore, useActions } from '../../store/StoreProvider';
import { selectTaxCenter } from '../../store/selectors';
import { Card, ProgressBar } from '../../components/primitives';
import { moneyWhole, money } from '../../lib/format';
import { YearPicker } from '../../components/PeriodPicker';

const REAL_CURRENT_YEAR = new Date().getFullYear();
// Two years back (still filable/relevant for reference) through two years
// ahead -- so a future assessment year becomes selectable as it rolls
// around without redesigning this component.
const TAX_YEAR_OPTIONS = [-2, -1, 0, 1, 2].map((offset) => REAL_CURRENT_YEAR + offset);

// Ported from Cukai v7.dc.html lines 1405-1501 (Tax Center screen).
// Data comes from selectTaxCenter(state); tax-year switch, relief-group
// expand/collapse and item-detail navigation are driven by store actions.

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'Available') return { bg: 'var(--color-neutral-200)', color: 'var(--color-text-muted)' };
  return { bg: 'var(--color-neutral-300)', color: 'var(--color-text-muted)' }; // Automatic, Optimised, In progress
}

export function TaxCenter() {
  const { state } = useStore();
  const actions = useActions();
  const tax = selectTaxCenter(state);

  const selectedYear = parseInt(state.taxYear.replace(/^YA/, ''), 10);
  const isCurrentTaxYear = selectedYear === REAL_CURRENT_YEAR;
  const taxHeroLabel = isCurrentTaxYear ? 'Deductible expenses YTD' : 'Total deductible expenses';
  const taxYtdLabel = moneyWhole(tax.totalCaptured);
  const taxDeltaAbsLabel = Math.abs(tax.taxDeltaPct);
  const taxDeltaDirectionLabel = tax.taxDeltaPct >= 0 ? 'ahead' : 'behind';
  const taxDeltaColor = tax.taxDeltaPct >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
  const taxDeltaArrowRotate = tax.taxDeltaPct >= 0 ? 'rotate(0deg)' : 'rotate(90deg)';

  return (
    <div className="screen-in" style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 6 }}>Tax Center</div>
        <YearPicker year={selectedYear} years={TAX_YEAR_OPTIONS} onChange={(y) => actions.setTaxYear('YA' + y)} />
      </div>

      {tax.hasReliefProfile && (
        <div style={{ fontSize: 11.5, color: 'var(--color-tax-700)', marginBottom: 12 }}>
          Personalised from your Tax Setup — focused on {tax.reliefProfileSummary}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Tax Optimisation</span>
          <span className="type-numeric" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--color-text)' }}>{tax.taxOptPct}%</span>
        </div>
        <div style={{ marginBottom: 14 }}>
          <ProgressBar pct={tax.taxOptPct} height={8} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            RM {moneyWhole(tax.totalCaptured)} of RM {moneyWhole(tax.totalCap)} claimed
          </div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>
            Save ~RM {moneyWhole(tax.totalPotentialBenefit)} more
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          Claiming the rest could save you an extra ~RM {moneyWhole(tax.totalPotentialBenefit)} in tax, estimated at
          {' '}{tax.taxBracketPct}%{' '}
          {tax.incomeKnown
            ? 'based on the income you entered'
            : `— a default rate, since you haven't entered your income yet`}
          {' '}— not guaranteed; verify with HASiL or a qualified tax professional.
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 16 }} />

      <Card style={{ marginBottom: 14, background: 'var(--color-surface)', border: '1.5px solid var(--color-neutral-300)', gap: 10 }} className="elev-md">
        <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{taxHeroLabel}</div>
        <div className="type-numeric" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--color-text)' }}>
          RM {taxYtdLabel}
        </div>
        {isCurrentTaxYear ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: taxDeltaColor, fontWeight: 600, fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ transform: taxDeltaArrowRotate }}>
              <path d="M7 17 17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
            {taxDeltaAbsLabel}% {taxDeltaDirectionLabel} of this time last year
          </div>
        ) : (
          <span className="tag tag-outline" style={{ alignSelf: 'flex-start', borderColor: 'var(--color-tax-600)', color: 'var(--color-tax-700)' }}>
            {selectedYear < REAL_CURRENT_YEAR ? 'Filed — year closed' : 'Upcoming year'}
          </span>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tax.groups.map((g) => {
            const gStyle = statusStyle(g.status);
            const expanded = state.expandedTaxGroup === g.key;
            return (
              <Card key={g.key}>
                <button
                  type="button"
                  onClick={() => actions.toggleTaxGroup(g.key)}
                  className="pressable"
                  style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{g.label}</span>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)"
                      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease', flexShrink: 0 }}
                    >
                      <path d="m9 18 6-6-6-6"></path>
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className="type-numeric" style={{ fontWeight: 700, fontSize: 17 }}>
                      RM {moneyWhole(g.captured)} <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {moneyWhole(g.cap)}</span>
                    </div>
                    <span className="tag" style={{ background: gStyle.bg, color: gStyle.color, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, padding: '4px 8px' }}>
                      {g.pct}% Complete
                    </span>
                  </div>
                  <ProgressBar pct={g.barPct} height={7} />
                </button>

                {expanded && (
                  <div className="pop-in" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-neutral-300)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--color-text-muted)', gap: 8 }}>
                      <span>RM {moneyWhole(g.remaining)} remaining</span>
                      {g.remaining > 0 && (
                        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>~RM {moneyWhole(g.potentialBenefit)} potential benefit</span>
                      )}
                    </div>
                    {g.items.map((it) => {
                      const itStyle = statusStyle(it.status);
                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => actions.openTaxItemDetail(`${g.key}:${it.key}`)}
                          className="pressable"
                          style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 5, gap: 8 }}>
                            <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{it.label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span className="tag" style={{ background: itStyle.bg, color: itStyle.color, whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, padding: '3px 7px' }}>
                                {it.pct}% Complete
                              </span>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6"></path>
                              </svg>
                            </span>
                          </div>
                          <div className="type-numeric" style={{ fontSize: 11.5, marginBottom: 5 }}>
                            <span style={{ fontWeight: 600 }}>RM {moneyWhole(it.captured)}</span>{' '}
                            <span style={{ color: 'var(--color-text-muted)' }}>/ RM {moneyWhole(it.cap)}</span>
                          </div>
                          <ProgressBar pct={it.barPct} height={5} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {tax.taxReceiptsAll.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Recent Tax Receipts
            </span>
            {tax.taxReceiptsHasMore && (
              <button
                type="button"
                onClick={actions.openTaxReceipts}
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-accent-700)', font: '700 11.5px var(--font-body)' }}
              >
                {`See all (${tax.taxReceiptsAll.length})`}
              </button>
            )}
          </div>
          <Card style={{ padding: '4px 14px' }}>
            {tax.taxReceiptsVisible.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{r.itemLabel} · {r.dateLabel}</div>
                </div>
                <div className="type-numeric" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>RM {money(r.amount)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20, background: 'var(--color-accent)', border: 'none' }}>
        <button
          type="button"
          onClick={actions.openTaxPack}
          className="pressable"
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box' }}
        >
          <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Download Tax Pack</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>All receipts &amp; relief totals, ready for e-Filing</div>
          </div>
          <span className="tag" style={{ flexShrink: 0, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>Premium</span>
        </button>
      </div>
    </div>
  );
}
