import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { Tab } from '../store/types';

// Ported from Cukai v7.dc.html lines 1573-1599: a floating pill nav bar
// (not a full-width bar), with the scan button as an overlapping circle at
// the top. Icons are the exact SVGs from the source, not emoji substitutes.

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6h-4v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      <path d="M21 12a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4h3a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function TaxIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="aiTabGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4d7cf7" />
          <stop offset="50%" stopColor="#9868d9" />
          <stop offset="100%" stopColor="#e26b95" />
        </linearGradient>
      </defs>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" stroke="url(#aiTabGrad)" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

const TABS: { key: Tab; label: string; Icon: () => ReactElement }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'finance', label: 'Finance', Icon: FinanceIcon },
  { key: 'tax', label: 'Tax', Icon: TaxIcon },
  { key: 'ai', label: 'AI', Icon: AiIcon },
];

const LENS_D = 50; // circular lens diameter during a scrub

export function TabBar({ active, onSelect, onScan }: { active: Tab; onSelect: (t: Tab) => void; onScan: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; w: number } | null>(null);
  // Non-null while the user is scrubbing the bar (iOS 26 / WhatsApp style):
  // x is the lens centre in bar-local px.
  const [scrubX, setScrubX] = useState<number | null>(null);
  const [slots, setSlots] = useState<{ key: Tab; cx: number }[]>([]);
  const startRef = useRef<{ x: number } | null>(null);
  const holdRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);

  // Measure the active tab button's box within the bar so the resting lens
  // springs to exactly under it — robust to the mid-bar scan-button gap.
  useLayoutEffect(() => {
    const btn = barRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (btn) setLens({ x: btn.offsetLeft + 2, w: btn.offsetWidth - 4 });
  }, [active]);

  const measureSlots = (): { key: Tab; cx: number }[] => {
    const bar = barRef.current;
    if (!bar) return [];
    const s = [...bar.querySelectorAll<HTMLElement>('[data-tab]')].map((el) => ({
      key: el.dataset.tab as Tab,
      cx: el.offsetLeft + el.offsetWidth / 2,
    }));
    setSlots(s);
    return s;
  };

  const clampX = (clientX: number, s: { cx: number }[]): number => {
    const r = barRef.current!.getBoundingClientRect();
    const lo = s[0]?.cx ?? 24;
    const hi = s[s.length - 1]?.cx ?? r.width - 24;
    return Math.max(lo, Math.min(hi, clientX - r.left));
  };

  const nearestTab = (x: number, s: { key: Tab; cx: number }[]): Tab => {
    let best = s[0];
    for (const slot of s) if (Math.abs(slot.cx - x) < Math.abs(best.cx - x)) best = slot;
    return best.key;
  };

  const enterScrub = (clientX: number) => {
    if (scrubbingRef.current || !barRef.current) return;
    const s = measureSlots();
    scrubbingRef.current = true;
    setScrubX(clampX(clientX, s));
  };
  const exitScrub = () => {
    scrubbingRef.current = false;
    setScrubX(null);
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-noscrub]')) return; // scan button
    const cx = e.clientX;
    startRef.current = { x: cx };
    barRef.current?.setPointerCapture(e.pointerId);
    holdRef.current = window.setTimeout(() => enterScrub(cx), 150);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!startRef.current) return;
    if (!scrubbingRef.current) {
      if (Math.abs(e.clientX - startRef.current.x) > 8) {
        if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
        enterScrub(e.clientX);
      }
      return;
    }
    setScrubX(clampX(e.clientX, slots));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
    if (scrubbingRef.current && scrubX != null && slots.length) {
      e.preventDefault();
      onSelect(nearestTab(scrubX, slots));
    }
    startRef.current = null;
    exitScrub();
    try { barRef.current?.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
  };
  const onPointerCancel = () => { startRef.current = null; exitScrub(); };

  const lensStyle = scrubX != null
    ? { transform: `translate3d(${scrubX - LENS_D / 2}px, 0, 0)`, width: LENS_D }
    : lens
      ? { transform: `translate3d(${lens.x}px, 0, 0)`, width: lens.w }
      : undefined;

  const bulgeFor = (key: Tab): number => {
    if (scrubX == null) return 0;
    const slot = slots.find((s) => s.key === key);
    if (!slot) return 0;
    return Math.max(0, 1 - Math.abs(scrubX - slot.cx) / 52);
  };

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 20, display: 'flex', justifyContent: 'center',
      zIndex: 100, pointerEvents: 'none',
    }}>
      <div
        ref={barRef}
        className={`material-chrome${scrubX != null ? ' is-scrubbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 999, boxShadow: 'var(--shadow-lg)', padding: '13px 20px', gap: 4,
          pointerEvents: 'auto', touchAction: 'none',
        }}
      >
        {lensStyle && (
          <div className={`tab-lens${scrubX != null ? ' is-circular' : ''}`} style={lensStyle} />
        )}
        {TABS.slice(0, 2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} bulge={bulgeFor(t.key)} onSelect={onSelect} />)}
        <div style={{ width: 62, flexShrink: 0 }} />
        {TABS.slice(2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} bulge={bulgeFor(t.key)} onSelect={onSelect} />)}

        <button
          type="button"
          onClick={onScan}
          aria-label="Scan receipt"
          data-noscrub
          className="pressable"
          style={{
            position: 'absolute', top: -29, left: '50%', transform: 'translateX(-50%)',
            width: 62, height: 62, borderRadius: '50%',
            background: 'linear-gradient(135deg,#17601F 0%,#1F7A2E 40%,#2E9E3F 70%,#5CC46F 100%)',
            border: '4px solid var(--color-bg)', boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
          }}
        >
          <ScanIcon />
        </button>
      </div>
    </div>
  );
}

function TabButton({ tab, active, bulge = 0, onSelect }: { tab: typeof TABS[number]; active: boolean; bulge?: number; onSelect: (t: Tab) => void }) {
  const color = active ? 'var(--color-accent-800)' : 'var(--color-text-muted)';
  return (
    <button
      type="button"
      className="tab-btn"
      data-tab={tab.key}
      data-active={active}
      onClick={() => onSelect(tab.key)}
      style={{
        background: 'none', border: 'none', padding: '9px 0', width: 66, borderRadius: 999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer',
        color: tab.key === 'ai' ? undefined : color,
      }}
    >
      <span
        style={{
          display: 'flex',
          transform: bulge ? `translateY(${(-7 * bulge).toFixed(1)}px) scale(${(1 + bulge * 0.5).toFixed(3)})` : undefined,
          transition: 'transform .14s cubic-bezier(.3,.9,.3,1)',
        }}
      >
        <tab.Icon />
      </span>
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color, opacity: bulge > 0.55 ? 1 : undefined }}>{tab.label}</span>
    </button>
  );
}
