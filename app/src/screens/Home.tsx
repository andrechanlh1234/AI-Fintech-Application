import { useStore, useActions } from '../store/StoreProvider';
import { selectHomeDashboard, selectNetWorth, selectNetWorthChart, selectReviewFlow } from '../store/selectors';
import { moneyWhole } from '../lib/format';
import { NOTIFICATIONS } from '../lib/seedData';
import { NetWorthSparkline } from '../components/NetWorthSparkline';
import { captureSharedOrigin } from '../lib/motion';

const ICONS = {
  car: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" /><circle cx="6.5" cy="16.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></svg>
  ),
  coffee: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" /></svg>
  ),
  bag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
  ),
  medical: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
  ),
  book: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
  ),
  arrowUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
  ),
};

export function Home() {
  const { state } = useStore();
  const actions = useActions();
  const dash = selectHomeDashboard(state);
  const nw = selectNetWorth(state);
  const chart = selectNetWorthChart(state);
  const review = selectReviewFlow(state);
  const hasUnreadNotifs = NOTIFICATIONS.length > 0;
  const hasReviewItems = review.reviewCount > 0;
  const isOverBudget = dash.homeBudgetSpent > dash.homeBudgetTotal;

  return (
    <div className="screen-in" style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M20 4C10 4 4 10 4 20c8 0 16-6 16-16Z" fill="var(--color-accent)" /><path d="M6 18C10 14 14 10 19 5" stroke="var(--color-accent)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" /></svg>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 23, letterSpacing: '0.01em' }}>Cukai</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={actions.openNotifPanel}
            aria-label="Notifications"
            className="pressable"
            style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: 'var(--color-surface)', border: '1.5px solid var(--color-neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>
            {hasUnreadNotifs && (
              <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-accent)', border: '1.5px solid var(--color-surface)' }} />
            )}
          </button>
          <button
            type="button"
            onClick={actions.openMorePanel}
            aria-label="Settings"
            className="pressable"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-surface)', border: '1.5px solid var(--color-neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={actions.goAi}
        className="pressable"
        style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer', background: 'var(--ai-card-bg)', border: '1px solid var(--color-neutral-300)', borderRadius: 'var(--radius-md)', padding: '11px 14px', boxSizing: 'border-box', marginBottom: 14 }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4d7cf7,#9868d9,#e26b95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--color-text)' }}>Ask me anything</div>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
      </button>

      <div style={{ marginBottom: 18, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-neutral-300)', boxShadow: 'var(--shadow-sm)' }}>
        <button
          type="button"
          onClick={(e) => { captureSharedOrigin(e.currentTarget); actions.goFinanceNetWorth(); }}
          className="pressable"
          style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Net worth</div>
          <div className="type-numeric" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', whiteSpace: 'nowrap', margin: '4px 0 4px' }}>RM {moneyWhole(nw.netWorth)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', fontWeight: 600, fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
            RM {moneyWhole(Math.abs(chart.delta))} ({chart.deltaPct}%)
          </div>
          <div style={{ margin: '10px 0 2px' }}>
            <NetWorthSparkline chart={chart} />
          </div>
        </button>
        <div style={{ borderTop: '1px solid var(--color-divider)', margin: '16px 0 14px' }} />
        <button
          type="button"
          onClick={actions.goFinanceBudgets}
          aria-label="View budget details"
          className="pressable"
          style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Monthly budget</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="type-numeric" style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              RM {moneyWhole(dash.homeBudgetSpent)} <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {moneyWhole(dash.homeBudgetTotal)}</span>
            </div>
            {isOverBudget ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger-700)', whiteSpace: 'nowrap' }}>RM {moneyWhole(dash.homeBudgetSpent - dash.homeBudgetTotal)} over</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-tax-700)', whiteSpace: 'nowrap' }}>RM {moneyWhole(dash.homeBudgetTotal - dash.homeBudgetSpent)} left</span>
            )}
          </div>
          <div style={{ height: 8, background: 'var(--color-neutral-300)', borderRadius: 4, overflow: 'hidden' }}>
            <div className="bar-fill" style={{ height: '100%', width: `${Math.min(100, dash.homeBudgetPct)}%`, background: isOverBudget ? 'var(--color-danger)' : 'var(--color-accent)', borderRadius: 4 }} />
          </div>
        </button>
      </div>

      {hasReviewItems && (
        <div style={{ marginBottom: 14, padding: '6px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-neutral-300)', boxShadow: 'var(--shadow-sm)' }}>
          <button
            type="button"
            onClick={actions.openReview}
            className="pressable"
            style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', padding: '14px 0', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' }}>{review.reviewCount} items to review</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      )}

      {dash.isPremiumHome && (
        <button
          type="button"
          onClick={actions.goTax}
          className="pressable"
          style={{ all: 'unset', display: 'block', width: '100%', textAlign: 'left', background: 'var(--color-tax-100)', border: '1.5px solid var(--color-tax-300)', borderRadius: 'var(--radius-md)', padding: '14px 16px', cursor: 'pointer', boxSizing: 'border-box', marginBottom: 14 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-tax-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /></svg>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--color-tax-800)', marginBottom: 2 }}>{dash.insight.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-tax-700)', lineHeight: 1.45 }}>{dash.insight.sub}</div>
            </div>
          </div>
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%', marginBottom: 10, boxSizing: 'border-box' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19 }}>Recent activity</span>
      </div>
      {dash.recentTx.map((tx) => (
        <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 12.5, background: tx.badgeBg, color: tx.badgeFg }}>
            {tx.hasBrand && tx.badgeLetter}
            {tx.isCar && ICONS.car}
            {tx.isCoffee && ICONS.coffee}
            {tx.isBag && ICONS.bag}
            {tx.isZap && ICONS.zap}
            {tx.isMedical && ICONS.medical}
            {tx.isBook && ICONS.book}
            {tx.isArrowUp && ICONS.arrowUp}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tx.merchant}</div>
          </div>
          {tx.tax && <span className="tag tag-tax" style={{ flexShrink: 0 }}>Tax</span>}
          <div className="type-numeric" style={{ fontWeight: 600, fontSize: 13.5, flexShrink: 0, color: tx.amountColor }}>{tx.amountLabel}</div>
        </div>
      ))}
      <button
        type="button"
        onClick={actions.goFinanceTransactions}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'block', color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '10px 0 0', textAlign: 'left' }}
      >
        See all →
      </button>
    </div>
  );
}
