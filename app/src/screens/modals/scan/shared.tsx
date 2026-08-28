import type { CSSProperties } from 'react';

// Pill style shared by the expense-name / merchant suggestion chips on the
// receipt review screen. (The old DateChips / PaymentChips helpers that also
// lived here are gone — the review screen now uses a plain native date input
// and a payment-method <select>.)
export function chipStyle(active: boolean): CSSProperties {
  return {
    all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 999, font: '600 12px var(--font-body)',
    border: '1.5px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-muted)', boxSizing: 'border-box',
  };
}
