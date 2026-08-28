import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectNetWorth, selectNetWorthChart, type NwRow } from '../../store/selectors';
import { money, moneyWhole } from '../../lib/format';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { animate, captureSharedOrigin, playSharedMorph, prefersReducedMotion, DUR, EASE_DECEL } from '../../lib/motion';
import { BRAND, subBadge } from '../../lib/constants';
import type { AppState } from '../../store/types';

const RANGE_OPTIONS: AppState['netWorthRange'][] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];

// Persists across mounts so the chart draw plays once per session and then
// only when the underlying data series actually changes — not on a
// back-nav or a range/filter toggle (spec §7).
let lastDrawnSeriesSig: string | null = null;

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
      onClick={row.clickable ? (e) => { captureSharedOrigin(e.currentTarget); onOpen(); } : undefined}
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

export function NetWorthSection() {
  const { state } = useStore();
  const actions = useActions();
  const nw = selectNetWorth(state);
  const chart = selectNetWorthChart(state);

  const netWorthDeltaText = 'RM ' + moneyWhole(Math.abs(chart.delta)) + ' (' + chart.deltaPct.toFixed(1) + '%)';

  // Chart-draw (spec §7): trace the line on, then fade in the fill + dots —
  // once per mount, and again only when the data series identity changes
  // (a real balance edit), never on a range toggle or back-nav.
  const lineRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const seriesSig = `${state.netWorthHistory?.length ?? 0}:${nw.netWorth.toFixed(2)}:${nw.assets.toFixed(2)}`;
  useEffect(() => {
    if (seriesSig === lastDrawnSeriesSig) return;
    lastDrawnSeriesSig = seriesSig;
    const line = lineRef.current;
    if (!line || prefersReducedMotion() || typeof line.getTotalLength !== 'function') return;
    const len = line.getTotalLength();
    if (!len) return;
    line.style.strokeDasharray = String(len);
    line.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: DUR.chart, easing: EASE_DECEL, fill: 'forwards' },
    ).addEventListener('finish', () => { line.style.strokeDasharray = ''; });
    animate(areaRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: DUR.chart * 0.45, fill: 'backwards' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesSig]);

  // Range switch (1M / 3M / … / ALL): use the *exact* same motion as the
  // Finance pane switcher (PageTransition) — a keyed remount of the chart
  // layer with `.page-enter-forward` / `.page-enter-back` (14px directional
  // slide + crossfade, .22s, cubic-bezier(.2,.7,.2,1)). Direction is derived
  // during render via the "store previous value in state" pattern, no refs.
  const rangeIdx = RANGE_OPTIONS.indexOf(state.netWorthRange);
  const [rangeSnap, setRangeSnap] = useState<{ range: string; idx: number; dir: 'forward' | 'back' | 'none' }>(
    { range: state.netWorthRange, idx: rangeIdx, dir: 'none' },
  );
  if (state.netWorthRange !== rangeSnap.range) {
    setRangeSnap({ range: state.netWorthRange, idx: rangeIdx, dir: rangeIdx >= rangeSnap.idx ? 'forward' : 'back' });
  }
  const rangeAnimClass = rangeSnap.dir === 'forward' ? 'page-enter-forward'
    : rangeSnap.dir === 'back' ? 'page-enter-back' : '';

  // Robust tooltip positioning: a fixed percentage clamp (the old approach)
  // assumes a tooltip width that never actually matches its rendered width,
  // so at responsive/narrow widths or long labels (e.g. the last point's
  // date + value) the pill would run past the clamp and sit on top of the
  // marker dot instead of beside it. Measure the pill's real width and the
  // chart's real width after each render/resize and clamp in pixels, so the
  // pill always stays fully inside the card and never overlaps the dot. The
  // dashed vertical guideline (drawn in the SVG below, at the true selCx)
  // is what visually ties the pill back to the exact selected point once
  // the pill itself has to shift away from directly above it.
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipLeftPx, setTooltipLeftPx] = useState<number | null>(null);
  const [tooltipTopPx, setTooltipTopPx] = useState<number | null>(null);

  // The SVG's own height is fixed (only its width is responsive), so the
  // pixel offset from the chart wrapper's top edge to the svg's y=0 is a
  // constant: the svg-container's 6px top margin.
  const SVG_PX_HEIGHT = 150;
  const SVG_TOP_MARGIN = 6;
  const DOT_RADIUS = 8;
  const GAP = 8;

  useLayoutEffect(() => {
    if (!chart.hasSelection) return;
    const wrap = chartWrapRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !tip) return;
    const recompute = () => {
      const containerWidth = wrap.clientWidth;
      if (!containerWidth) return;
      const anchorPx = (chart.selCx / 300) * containerWidth;
      const tipWidth = tip.offsetWidth;
      const pad = 4;
      const maxLeft = Math.max(pad, containerWidth - tipWidth - pad);
      const rawLeft = anchorPx - tipWidth / 2;
      setTooltipLeftPx(Math.min(maxLeft, Math.max(pad, rawLeft)));

      // Vertical: place the pill directly above the selected dot by
      // default (matching every other point on the line), but a point
      // near the TOP of the chart's own value range (a local peak or the
      // series max) puts the dot too close to that default band for the
      // pill to clear it -- flip to below the dot instead whenever there
      // isn't enough headroom, rather than special-casing "first/last" or
      // nudging a fixed offset by a few px.
      const dotYAbs = SVG_TOP_MARGIN + (chart.selCy / 140) * SVG_PX_HEIGHT;
      const tipHeight = tip.offsetHeight;
      const topPad = -4;
      const above = dotYAbs - DOT_RADIUS - GAP - tipHeight;
      setTooltipTopPx(above >= topPad ? above : dotYAbs + DOT_RADIUS + GAP);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); };
  }, [chart.hasSelection, chart.selCx, chart.selCy, chart.selectedLabel, chart.selectedValueLabel]);

  const scrubAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    actions.selectNwPoint(Math.round(pct * (chart.pointCount - 1)));
  };
  const draggingRef = useRef(false);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => { draggingRef.current = true; scrubAt(e.clientX, e.currentTarget); };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (draggingRef.current) scrubAt(e.clientX, e.currentTarget); };
  const onUp = () => { draggingRef.current = false; };

  const openRow = (row: NwRow) => {
    if (!row.clickable || !row.id) return;
    if (row.listKey.includes('invest')) actions.openInvestDetail(row.listKey, row.id);
    else actions.openBalanceDetail(row.listKey, row.id);
  };

  // Shared-element landing: if the user arrived here by tapping Home's
  // Net worth card, morph that card's frame into this screen's header.
  const morphRef = useRef<HTMLDivElement>(null);
  useEffect(() => { playSharedMorph(morphRef.current); }, []);

  return (
    <div ref={morphRef}>
      <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Net worth</div>
      <AnimatedNumber
        className="type-numeric"
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap', margin: '4px 0 6px', display: 'block' }}
        value={nw.netWorth}
        format={money}
        prefix="RM "
      />
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

      <div ref={chartWrapRef} style={{ position: 'relative' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {chart.hasSelection && (
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute', top: tooltipTopPx ?? -4, left: tooltipLeftPx ?? 0,
              visibility: tooltipLeftPx == null || tooltipTopPx == null ? 'hidden' : 'visible',
              background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6, boxShadow: 'var(--shadow-sm)', pointerEvents: 'none', zIndex: 2,
            }}
          >
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{chart.selectedLabel}</span>
            <span className="type-numeric" style={{ fontWeight: 700, fontSize: 12.5 }}>RM {chart.selectedValueLabel}</span>
          </div>
        )}
        <div key={rangeSnap.range} className={rangeAnimClass} style={{ position: 'relative', margin: '6px 0 4px' }}>
          <svg width="100%" height="150" viewBox="0 0 300 140" preserveAspectRatio="none" style={{ display: 'block', touchAction: 'none' }}>
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
            <polygon ref={areaRef} points={chart.areaPoints} fill="url(#nwFill)" />
            <polyline ref={lineRef} points={chart.linePoints} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {chart.seriesLabels && chart.pts.map(([cx, cy], i) => (
              <circle
                key={i} cx={cx} cy={cy} r={9} fill="transparent" style={{ cursor: 'pointer' }}
                // Tapping the already-selected point again clears it -- the
                // only way to dismiss now that there's no dedicated close
                // button (removed so selecting/deselecting never shifts the
                // chart's layout up or down).
                onClick={() => (state.nwSelectedIdx === i ? actions.clearNwSelection() : actions.selectNwPoint(i))}
              />
            ))}
          </svg>
          {/* The dots below are HTML, not SVG, deliberately: the svg above
              uses preserveAspectRatio="none" so the line/area fill stretch to
              exactly fill the card width, but that stretch is non-uniform
              (x-scale != y-scale) and would turn an SVG <circle> into an
              ellipse. Position these by percentage of the same 300x140
              coordinate space instead, so they render as true fixed-size
              circles regardless of card width. */}
          {/* A single real point (a brand-new account, or a range with only
              one snapshot) needs an explicit dot -- a 1-point polyline/
              polygon renders nothing at all, leaving the chart blank. */}
          {chart.pts.length === 1 && (
            <div style={{
              position: 'absolute', left: `${(chart.pts[0][0] / 300) * 100}%`, top: `${(chart.pts[0][1] / 140) * 100}%`,
              width: 12, height: 12, borderRadius: '50%', background: 'var(--color-accent)', border: '3px solid var(--color-surface)', boxSizing: 'border-box',
              boxShadow: '0 1px 4px rgba(0,0,0,0.35)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 3,
            }} />
          )}
          {chart.hasSelection && (
            // Deliberately larger than the line stroke (2.5px) and with a
            // thick surface-color ring + shadow, not just a bare fill dot --
            // at the same accent color as the line itself, a thin ring was
            // the only thing distinguishing "selected point" from "the line
            // has a vertex here", and it read as invisible at a glance.
            <div style={{
              position: 'absolute', left: `${(chart.selCx / 300) * 100}%`, top: `${(chart.selCy / 140) * 100}%`,
              width: 16, height: 16, borderRadius: '50%', background: 'var(--color-accent)', border: '3px solid var(--color-surface)', boxSizing: 'border-box',
              boxShadow: '0 1px 4px rgba(0,0,0,0.35)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 3,
            }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, margin: '10px 0 20px' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total assets</div>
          <AnimatedNumber className="type-numeric" style={{ fontWeight: 700, fontSize: 15, display: 'block' }} value={nw.assets} format={moneyWhole} prefix="RM " />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Liabilities</div>
          <AnimatedNumber className="type-numeric" style={{ fontWeight: 700, fontSize: 15, display: 'block' }} value={nw.liabilities} format={moneyWhole} prefix="RM " />
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
                  <NwRowView key={row.listKey + ':' + (row.id ?? row.idx)} row={row} onOpen={() => openRow(row)} />
                ))}
                {grp.rows.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '4px 0 10px' }}>Nothing here yet.</div>
                )}
                <div style={{ display: 'flex', gap: 16, paddingTop: grp.rows.length ? 10 : 0 }}>
                  {grp.key === 'cash' && <AddLink label="Add account" onClick={() => actions.addRecord('bankAccounts')} />}
                  {grp.key === 'invest' && <AddLink label="Add investment" onClick={actions.addInvestmentRow} />}
                  {grp.key === 'other' && <AddLink label="Add property" onClick={() => actions.addRecord('properties')} />}
                  {grp.key === 'liab' && <AddLink label="Add card" onClick={() => actions.addRecord('creditCards')} />}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
