// Shared bits used across onboarding steps: header (back/progress/skip), chip-option
// buttons, and small inline icons. Ported from Cukai v7.dc.html lines 63-503.
import type { CSSProperties, ReactNode } from 'react';
import { chipStyle } from '../../../lib/constants';

export function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

export function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

export function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function StepHeader({ progress, onBack, onSkip }: { progress: string; onBack: () => void; onSkip: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 8 }}>
      <button
        type="button" onClick={onBack} aria-label="Back" className="pressable"
        style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
      >
        <BackIcon />
      </button>
      <span style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>{progress}</span>
      <button
        type="button" onClick={onSkip} className="pressable"
        style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', font: '600 12px var(--font-body)', color: 'var(--color-text-muted)' }}
      >
        Skip
      </button>
    </div>
  );
}

export interface ChipOpt { label: string; onClick: () => void; bg: string; color: string; borderColor: string }

export function singleOpts(list: string[], current: string | null, onSelect: (label: string) => void): ChipOpt[] {
  return list.map((label) => ({ label, onClick: () => onSelect(label), ...chipStyle(current === label) }));
}

export function multiOpts(list: string[], current: string[], onToggle: (label: string) => void): ChipOpt[] {
  return list.map((label) => ({ label, onClick: () => onToggle(label), ...chipStyle(current.includes(label)) }));
}

export function Chip({ opt, style }: { opt: ChipOpt; style?: CSSProperties }) {
  return (
    <button
      type="button" onClick={opt.onClick} className="pressable"
      style={{
        borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '600 13px var(--font-body)',
        border: `1.5px solid ${opt.borderColor}`, background: opt.bg, color: opt.color, ...style,
      }}
    >
      {opt.label}
    </button>
  );
}

export function ChipRow({ opts, style, chipStyleOverride }: { opts: ChipOpt[]; style?: CSSProperties; chipStyleOverride?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, ...style }}>
      {opts.map((opt) => <Chip key={opt.label} opt={opt} style={chipStyleOverride} />)}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>{children}</div>;
}

export function OtherInput({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: CSSProperties }) {
  return (
    <input
      className="input" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Tell us more" style={style}
    />
  );
}
