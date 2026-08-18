import type { CSSProperties, ReactNode } from 'react';

export function Card({ children, style, onClick, className }: { children: ReactNode; style?: CSSProperties; onClick?: () => void; className?: string }) {
  return (
    <div
      className={['card', onClick ? 'pressable' : '', className || ''].join(' ').trim()}
      style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  children, variant = 'primary', onClick, disabled, style, type = 'button', block,
}: {
  children: ReactNode; variant?: ButtonVariant; onClick?: () => void; disabled?: boolean;
  style?: CSSProperties; type?: 'button' | 'submit'; block?: boolean;
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${block ? ' btn-block btn-lg' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

type TagVariant = 'accent' | 'danger' | 'neutral' | 'outline' | 'tax';

export function Tag({ children, variant = 'neutral', style }: { children: ReactNode; variant?: TagVariant; style?: CSSProperties }) {
  return <span className={`tag tag-${variant}`} style={style}>{children}</span>;
}

export function ProgressBar({ pct, color = 'var(--color-accent)', trackColor = 'var(--color-neutral-300)', height = 6 }: { pct: number; color?: string; trackColor?: string; height?: number }) {
  return (
    <div style={{ width: '100%', height, borderRadius: 999, background: trackColor, overflow: 'hidden' }}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 999, background: color }} />
    </div>
  );
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="pressable"
      style={{
        width: 44, height: 26, borderRadius: 999, position: 'relative', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--color-accent)' : 'var(--color-neutral-400)', transition: 'background-color .2s ease',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s cubic-bezier(.34,1.56,.64,1)',
      }} />
    </div>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <label key={opt} className="seg-opt">
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

export function IconBadge({
  letter, bg = 'var(--color-neutral-200)', fg = 'var(--color-text-muted)', size = 40,
}: { letter?: string; bg?: string; fg?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: size * 0.42,
    }}>
      {letter}
    </div>
  );
}

export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable"
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        border: '1.5px solid', cursor: 'pointer', fontFamily: 'var(--font-body)',
        background: active ? 'var(--color-accent)' : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text)',
        borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
      }}
    >
      {label}
    </button>
  );
}
