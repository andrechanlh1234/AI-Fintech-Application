import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { Tab } from '../store/types';

// Ported from Cukai v7.dc.html lines 1573-1599: a floating pill nav bar
// (not a full-width bar), with the scan button as an overlapping circle at
// the top. Icons are the exact SVGs from the source, not emoji substitutes.

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6h-4v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      <path d="M21 12a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4h3a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function TaxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

export function TabBar({ active, onSelect, onScan }: { active: Tab; onSelect: (t: Tab) => void; onScan: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; w: number } | null>(null);

  // Measure the active tab button's box within the bar so the glass lens
  // springs to exactly under it — robust to the mid-bar scan-button gap and
  // any future layout change, no hardcoded slot maths.
  useLayoutEffect(() => {
    const btn = barRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (btn) setLens({ x: btn.offsetLeft + 3, w: btn.offsetWidth - 6 });
  }, [active]);

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 20, display: 'flex', justifyContent: 'center',
      zIndex: 100, pointerEvents: 'none',
    }}>
      <div
        ref={barRef}
        className="material-chrome"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 999, boxShadow: 'var(--shadow-lg)', padding: '10px 16px', gap: 2, pointerEvents: 'auto',
        }}
      >
        {lens && (
          <div className="tab-lens" style={{ transform: `translate3d(${lens.x}px, 0, 0)`, width: lens.w }} />
        )}
        {TABS.slice(0, 2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} onSelect={onSelect} />)}
        <div style={{ width: 56, flexShrink: 0 }} />
        {TABS.slice(2).map((t) => <TabButton key={t.key} tab={t} active={active === t.key} onSelect={onSelect} />)}

        <button
          type="button"
          onClick={onScan}
          aria-label="Scan receipt"
          className="pressable"
          style={{
            position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
            width: 56, height: 56, borderRadius: '50%',
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

function TabButton({ tab, active, onSelect }: { tab: typeof TABS[number]; active: boolean; onSelect: (t: Tab) => void }) {
  const color = active ? 'var(--color-accent-800)' : 'var(--color-text-muted)';
  return (
    <button
      type="button"
      className="tab-btn"
      data-active={active}
      onClick={() => onSelect(tab.key)}
      style={{
        background: 'none', border: 'none', padding: '8px 0', width: 58, borderRadius: 999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
        color: tab.key === 'ai' ? undefined : color,
      }}
    >
      <tab.Icon />
      <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, color }}>{tab.label}</span>
    </button>
  );
}
