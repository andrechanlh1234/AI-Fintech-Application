import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectNetWorth, selectNetWorthChart, type NwRow } from '../../store/selectors';
import { money, moneyWhole } from '../../lib/format';
import { BRAND, subBadge } from '../../lib/constants';
import type { AppState, ManualData } from '../../store/types';

type ManualListKey = Exclude<keyof ManualData, 'investments'>;

const RANGE_OPTIONS: AppState['netWorthRange'][] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];

function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable"
      style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="M12 5v14" />
      </svg>
      {label}
    </button>
  );
}

function NwRowView({ row, onOpen }: { row: NwRow; onOpen: () => void }) {
  const badge = (row.brand && BRAND[row.brand]) || subBadge(row.name || '?');
  return (
    <button
      type="button"
      onClick={row.clickable ? onOpen : undefined}
      className="pressable"
      style={{
        all: 'unset', cursor: row.clickable ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
        gap: 12, width: '100%', boxSizing: 'border-box', padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 700, fontSize: 12.5, background: badge.bg, color: badge.fg,
      }}>
        {badge.letter}
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{row.subLabel}</div>
      </div>
      <div className="type-numeric" style={{ fontSize: 14, fontWeight: 600 }}>RM {money(row.balanceValue)}</div>
      {row.clickable && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

// Manual entries (the normal case — there's no real bank sync) are edited
// right here: name + amount (or, for investments, qty/buy/cur), with a
// remove button. This is what makes "+ Add account" actually visible and
// usable immediately, instead of adding an invisible unnamed row.
function NwManualRowView({ row }: { row: NwRow }) {
  const actions = useActions();
  const isInvest = row.listKey === 'investments';

  const remove = () => {
    if (isInvest && row.idx != null) actions.removeInvestmentRow(row.idx);
    else if (row.id) actions.removeRecord(row.listKey as ManualListKey, row.id);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
      {isInvest ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <input
            className="input" value={row.name} placeholder="Investment name"
            onChange={(e) => row.idx != null && actions.setInvestField(row.idx, 'name', e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" value={row.qty ?? ''} placeholder="Qty" style={{ flex: 1 }}
              onChange={(e) => row.idx != null && actions.setInvestField(row.idx, 'qty', e.target.value)} />
            <input className="input" value={row.buy ?? ''} placeholder="Buy price" style={{ flex: 1 }}
              onChange={(e) => row.idx != null && actions.setInvestField(row.idx, 'buy', e.target.value)} />
            <input className="input" value={row.cur ?? ''} placeholder="Current price" style={{ flex: 1 }}
              onChange={(e) => row.idx != null && actions.setInvestField(row.idx, 'cur', e.target.value)} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input" value={row.name} placeholder="Name" style={{ flex: 1.3 }}
              onChange={(e) => row.id && actions.setRecordField(row.listKey as ManualListKey, row.id, 'name', e.target.value)}
            />
            <input
              className="input" value={row.rawAmount ?? ''} placeholder="Amount (RM)" style={{ flex: 1 }}
              onChange={(e) => row.id && actions.setRecordField(row.listKey as ManualListKey, row.id, 'amount', e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>As of</span>
            <input
              className="input" type="date" value={row.rawDate ?? ''} style={{ fontSize: 12.5, flex: 1 }}
              aria-label="As of date"
              onChange={(e) => row.id && actions.setRecordField(row.listKey as ManualListKey, row.id, 'date', e.target.value)}
            />
          </div>
        </div>
      )}
      <button
        type="button" onClick={remove} aria-label="Remove" className="pressable"
        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NetWorthSection() {
  const { state } = useStore();
  const actions = useActions();
  const nw = selectNetWorth(state);
  const chart = selectNetWorthChart(state);

  const netWorthLabel = money(nw.netWorth);
  const netWorthDeltaText = 'RM ' + moneyWhole(Math.abs(chart.delta)) + ' (' + chart.deltaPct.toFixed(1) + '%)';
  const assetsLabel = moneyWhole(nw.assets);
  const liabilitiesLabel = moneyWhole(nw.liabilities);

  const nwTooltipLeftPct = Math.min(92, Math.max(8, (chart.selCx / 300) * 100));

  const scrubAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    actions.selectNwPoint(Math.round(pct * (chart.pointCount - 1)));
  };
  let dragging = false;
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => { dragging = true; scrubAt(e.clientX, e.currentTarget); };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragging) scrubAt(e.clientX, e.currentTarget); };
  const onUp = () => { dragging = false; };

  const openRow = (row: NwRow) => {
    if (!row.clickable || !row.id) return;
    if (row.listKey.includes('invest')) actions.openInvestDetail(row.listKey, row.id);
    else actions.openBalanceDetail(row.listKey, row.id);
  };

  return (
    <div>
      <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Net worth</div>
      <div className="type-numeric" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap', margin: '4px 0 6px' }}>RM {netWorthLabel}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', fontWeight: 600, fontSize: 12.5, marginBottom: 14 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7" />
          <path d="M7 7h10v10" />
        </svg>
        {netWorthDeltaText}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {RANGE_OPTIONS.map((rg) => {
          const active = state.netWorthRange === rg;
          return (
            <button
              key={rg}
              type="button"
              onClick={() => actions.setNetWorthRange(rg)}
              className="pressable"
              style={{
                padding: '6px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '700 11px var(--font-body)',
                background: active ? 'var(--color-accent)' : 'transparent', color: active ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {rg}
            </button>
          );
        })}
      </div>

      {chart.hasSelection && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 -2px' }}>
          <button
            type="button"
            onClick={actions.clearNwSelection}
            aria-label="Clear"
            className="pressable"
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 2 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}

      <div style={{ position: 'relative' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {chart.hasSelection && (
          <div style={{ position: 'absolute', top: -4, left: `${nwTooltipLeftPct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 2 }}>
            <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{chart.selectedLabel}</span>
              <span className="type-numeric" style={{ fontWeight: 700, fontSize: 12.5 }}>RM {chart.selectedValueLabel}</span>
            </div>
            <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1a1a1a' }} />
          </div>
        )}
        <svg width="100%" height="150" viewBox="0 0 300 140" preserveAspectRatio="none" style={{ margin: '6px 0 4px', display: 'block', touchAction: 'none' }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <line x1="0" y1="128" x2="300" y2="128" stroke="var(--color-neutral-400)" strokeWidth={1} strokeDasharray="3,4" />
          {chart.hasSelection && (
            <line x1={chart.selCx} y1={0} x2={chart.selCx} y2={140} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          )}
          <polygon points={chart.areaPoints} fill="url(#nwFill)" />
          <polyline points={chart.linePoints} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* A single real point (a brand-new account, or a range with only
              one snapshot) needs an explicit dot -- a 1-point polyline/
              polygon renders nothing at all, leaving the chart blank. */}
          {chart.pts.length === 1 && (
            <circle cx={chart.pts[0][0]} cy={chart.pts[0][1]} r={4} fill="var(--color-accent)" />
          )}
          {chart.seriesLabels && chart.pts.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={9} fill="transparent" onClick={() => actions.selectNwPoint(i)} style={{ cursor: 'pointer' }} />
          ))}
          {chart.hasSelection && (
            <circle cx={chart.selCx} cy={chart.selCy} r={5} fill="var(--color-accent)" stroke="#fff" strokeWidth={2} />
          )}
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 28, margin: '10px 0 20px' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total assets</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 15 }}>RM {assetsLabel}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Liabilities</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 15 }}>RM {liabilitiesLabel}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 16 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {nw.groups.map((grp) => (
          <div className="card" key={grp.key}>
            <button
              type="button"
              onClick={() => actions.toggleNwGroup(grp.key)}
              className="pressable"
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}
            >
              <span style={{ fontWeight: 500, fontSize: 16 }}>{grp.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="type-numeric" style={{ fontWeight: 700, fontSize: 14 }}>RM {money(grp.totalVal)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: grp.expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </button>
            {grp.expanded && (
              <div className="pop-in" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-neutral-300)' }}>
                {grp.rows.map((row) => (
                  row.isManual
                    ? <NwManualRowView key={row.listKey + ':' + (row.id ?? row.idx)} row={row} />
                    : <NwRowView key={row.listKey + ':' + row.id} row={row} onOpen={() => openRow(row)} />
                ))}
                {grp.rows.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '4px 0 10px' }}>Nothing here yet.</div>
                )}
                <div style={{ display: 'flex', gap: 16, paddingTop: grp.rows.length ? 10 : 0 }}>
                  {grp.key === 'cash' && <AddLink label="Add account" onClick={() => actions.addRecord('bankAccounts')} />}
                  {grp.key === 'invest' && <AddLink label="Add investment" onClick={actions.addInvestmentRow} />}
                  {grp.key === 'other' && <>
                    <AddLink label="Add property" onClick={() => actions.addRecord('properties')} />
                    <AddLink label="Add other asset" onClick={() => actions.addRecord('otherAssets')} />
                  </>}
                  {grp.key === 'liab' && <>
                    <AddLink label="Add card" onClick={() => actions.addRecord('creditCards')} />
                    <AddLink label="Add liability" onClick={() => actions.addRecord('liabilities')} />
                  </>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
