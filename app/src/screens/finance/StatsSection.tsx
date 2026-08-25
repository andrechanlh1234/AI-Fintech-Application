import { useStore, useActions } from '../../store/StoreProvider';
import { selectStatsPage } from '../../store/selectors';
import { Card } from '../../components/primitives';
import { MonthPicker } from '../../components/PeriodPicker';

// Natural height of MonthPicker's collapsed summary row + its wrapper's
// bottom margin -- kept as a fixed constant (measured against the rendered
// control) so the reveal/collapse can animate `height` the same way
// BudgetGauge animates its half-donut box, rather than snapping open/shut.
const MONTH_PICKER_HEIGHT = 48;

function TxIcon({ tx }: { tx: ReturnType<typeof selectStatsPage>['statsCategoryDetailTx'][number] }) {
  if (tx.hasBrand) return <>{tx.badgeLetter}</>;
  if (tx.isCar)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
      </svg>
    );
  if (tx.isCoffee)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    );
  if (tx.isBag)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  if (tx.isZap)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
      </svg>
    );
  if (tx.isMedical)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  if (tx.isBook)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </svg>
    );
  if (tx.isArrowUp)
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    );
  return null;
}

function StatsCategoryDetail() {
  const { state } = useStore();
  const actions = useActions();
  const data = selectStatsPage(state);
  if (!state.statsCategoryDetail) return null;

  return (
    <div
      className="screen-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 47, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 24px', boxSizing: 'border-box', overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button
          type="button"
          onClick={actions.closeStatsCategoryDetail}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{state.statsCategoryDetail}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        {state.statsPeriod} · RM {data.statsCategoryDetailTotal}
      </div>
      {data.statsCategoryDetailTx.map((tx, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-neutral-300)' }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontWeight: 700, fontSize: 11.5, background: tx.badgeBg, color: tx.badgeFg,
            }}
          >
            <TxIcon tx={tx} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tx.merchant}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
              {tx.dateLabel} · {tx.payment}
            </div>
          </div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0, color: tx.amountColor }}>
            {tx.amountLabel}
          </div>
        </div>
      ))}
      {data.statsCategoryDetailTx.length === 0 && (
        <div style={{ padding: '24px 4px', fontSize: 14, color: 'var(--color-text-muted)' }}>No transactions in this period.</div>
      )}
    </div>
  );
}

// Full-circle doughnut of category spend, replacing the old stacked bar --
// same stroke-dasharray-per-segment technique as BudgetGauge's half-donut,
// just closed into a full ring since there's no spent/remaining split here.
function StatsDoughnut({ bars, sumLabel }: { bars: ReturnType<typeof selectStatsPage>['statsCategoryBars']; sumLabel: string }) {
  const R = 80;
  const C = 2 * Math.PI * R;
  let cumulative = 0;

  return (
    <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 24px' }}>
      <svg width={200} height={200} viewBox="0 0 200 200">
        <circle cx={100} cy={100} r={R} fill="none" stroke="var(--color-neutral-200)" strokeWidth={28} />
        {bars.map((c) => {
          const dash = (c.pct / 100) * C;
          const offset = -((cumulative / 100) * C);
          cumulative += c.pct;
          return (
            <circle
              key={c.name}
              cx={100}
              cy={100}
              r={R}
              fill="none"
              stroke={c.color}
              strokeWidth={28}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="type-numeric" style={{ fontWeight: 800, fontSize: 22 }}>RM {sumLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>Spent</div>
      </div>
    </div>
  );
}

export default function StatsSection() {
  const { state } = useStore();
  const actions = useActions();
  const data = selectStatsPage(state);

  return (
    <>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, marginBottom: 12 }}>Spend by category</div>
        <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
          {data.statsPeriodOptions.map((opt) => {
            const active = state.statsPeriod === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => actions.setStatsPeriod(opt)}
                className="pressable"
                style={{
                  flexShrink: 0, whiteSpace: 'nowrap',
                  padding: '6px 12px', borderRadius: 999, cursor: 'pointer', font: '600 12.5px var(--font-body)',
                  border: '1.5px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
                  background: active ? 'var(--color-accent-100)' : 'var(--color-surface)',
                  color: active ? 'var(--color-accent-700)' : 'var(--color-text-muted)',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <div
          style={{
            height: state.statsPeriod === 'Choose month' ? MONTH_PICKER_HEIGHT : 0,
            overflow: state.statsPeriod === 'Choose month' ? 'visible' : 'hidden',
            transition: 'height .35s ease',
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <MonthPicker month={state.historyMonth} year={state.historyYear} onChange={(m, y) => { actions.setHistoryMonth(m); actions.setHistoryYear(y); }} />
          </div>
        </div>
        <StatsDoughnut bars={data.statsCategoryBars} sumLabel={data.statsCategorySumLabel} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.statsCategoryBars.map((c) => (
            <Card key={c.name} style={{ padding: 16 }}>
              <button
                type="button"
                onClick={() => actions.openStatsCategoryDetail(c.name)}
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: 14.5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  {c.name}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="type-numeric" style={{ fontWeight: 700, fontSize: 12.5 }}>RM {c.amountLabel}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
              </button>
            </Card>
          ))}
        </div>
        {data.statsCategoryBars.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '6px 0 18px' }}>No spending in this period.</div>
        )}
      </div>

      {state.statsCategoryDetail != null && <StatsCategoryDetail />}
    </>
  );
}
