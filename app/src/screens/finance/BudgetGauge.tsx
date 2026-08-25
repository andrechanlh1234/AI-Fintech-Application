import { useStore, useActions } from '../../store/StoreProvider';
import { selectBudgetGauge } from '../../store/selectors';

// Ported from Cukai v7.dc.html lines 1298-1327: the half-donut budget gauge
// at the top of the Budgets screen. Tap to expand a per-category breakdown
// (top 5 categories by spend, radiating callout labels).
export function BudgetGauge() {
  const { state } = useStore();
  const actions = useActions();
  const g = selectBudgetGauge(state);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
      <div style={{ position: 'relative', width: 300, height: g.gaugeBoxHeight, margin: '6px 0 4px', overflow: g.gaugeOverflow, transition: 'height .35s ease' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${g.gaugeShiftY}px)`, transition: 'transform .35s ease' }}>
          <div
            onClick={actions.toggleDonutExpanded}
            aria-label="Explore budget breakdown"
            className="pressable"
            style={{ cursor: 'pointer', position: 'absolute', inset: 0 }}
          >
            <svg width={300} height={280} viewBox="0 0 300 280" style={{ position: 'absolute', inset: 0 }}>
              <path d={g.gaugeArcPath} fill="none" stroke="var(--color-accent-200)" strokeWidth={16} strokeLinecap="round" />
              <path d={g.spentArcPath} fill="none" stroke={g.gaugeOverspent ? 'var(--color-danger)' : 'var(--color-accent)'} strokeWidth={16} strokeLinecap="round" style={{ transition: 'd .6s ease, stroke .2s ease' }} />
              {g.donutBranches.map((br) => (
                <g key={br.bucketKey + ':' + br.catId}>
                  <circle cx={br.x1} cy={br.y1} r={3} fill={br.color} />
                  <line x1={br.x1} y1={br.y1} x2={br.x2} y2={br.y2} stroke={br.color} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
                </g>
              ))}
            </svg>
            <div style={{ position: 'absolute', left: '50%', top: 150, transform: 'translate(-50%,0)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="type-numeric" style={{ fontWeight: 800, fontSize: 28 }}>RM {g.budgetRemainingLabel}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 1 }}>left this month</div>
            </div>
            <div className="type-numeric" style={{ position: 'absolute', left: 40, top: 222, transform: 'translateX(-50%)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>RM0</div>
            <div className="type-numeric" style={{ position: 'absolute', left: 260, top: 222, transform: 'translateX(-50%)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>RM {g.budgetPlanTotalLabel}</div>
            {/* Badge riding the exact boundary between the filled and
                unfilled arc -- gaugeMidX/Y is the same point the arc paths
                themselves are built from, so the badge can never drift out
                of sync with the fill. Percentage shown is the true,
                uncapped value (can exceed 100 on an overspent month) even
                though the arc itself necessarily stops at a full circle. */}
            <div
              className="type-numeric"
              style={{
                position: 'absolute', left: g.gaugeMidX, top: g.gaugeMidY, transform: 'translate(-50%,-50%)',
                width: 34, height: 34, borderRadius: '50%', background: 'var(--color-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: g.gaugeOverspent ? 'var(--color-danger-700)' : 'var(--color-accent-700)',
                boxShadow: '0 1px 5px rgba(0,0,0,0.22)', border: '1px solid var(--color-divider)',
                transition: 'left .6s ease, top .6s ease',
              }}
            >
              {g.gaugeSpentPct}%
            </div>
          </div>
          {g.donutBranches.map((br) => (
            <button
              key={br.bucketKey + ':' + br.catId}
              type="button"
              onClick={() => actions.openBudgetItemDetail(br.bucketKey + ':' + br.catId)}
              className="pressable pop-in"
              style={{
                all: 'unset', cursor: 'pointer', position: 'absolute', left: br.calloutLeft, top: br.calloutTop,
                transform: 'translate(-50%,-100%)', textAlign: 'center', lineHeight: 1.3,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{br.name}</div>
              <div className="type-numeric" style={{ fontSize: 12.5, fontWeight: 700 }}>RM {br.amountLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700 }}>{br.pct}%</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{g.donutHint}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 16, padding: '0 4px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spent</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>RM {g.budgetSpentTotalLabel}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per day left</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 14, marginTop: 2, color: 'var(--color-accent-700)' }}>RM {g.budgetPerDayLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budgeted</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>RM {g.budgetPlanTotalLabel}</div>
        </div>
      </div>
    </div>
  );
}
