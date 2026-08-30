import { useEffect, useRef, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { money, formatWithCommas } from '../../lib/format';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { AmountKeypadSheet } from '../../components/AmountKeypadSheet';
import { playSharedMorph } from '../../lib/motion';
import type { ManualData } from '../../store/types';

interface InvRow { id: string; name: string; qty: string; buy: string; cur: string }

function resolveRow(state: ReturnType<typeof useStore>['state'], listKey: string, id: string): InvRow | null {
  if (listKey.startsWith('seed.')) {
    const seedKey = listKey.slice(5) as 'investments';
    const list = state.netWorthSeed[seedKey] as unknown as InvRow[];
    return list.find((r) => r.id === id) || null;
  }
  const list = state.ob.manual[listKey as keyof ManualData] as unknown as InvRow[];
  return (list && list.find((r) => r.id === id)) || null;
}

export function InvestDetailModal() {
  const { state } = useStore();
  const actions = useActions();
  const morphRef = useRef<HTMLDivElement>(null);
  useEffect(() => { playSharedMorph(morphRef.current); }, []);
  const [keypad, setKeypad] = useState<'qty' | 'buy' | 'cur' | null>(null);

  if (!state.investDetailOpen) return null;
  const sep = state.investDetailOpen.indexOf(':');
  const listKey = state.investDetailOpen.slice(0, sep);
  const id = state.investDetailOpen.slice(sep + 1);
  const rec = resolveRow(state, listKey, id);
  if (!rec) return null;

  const isManual = !listKey.startsWith('seed.');
  const qty = parseFloat(rec.qty) || 0;
  const buy = parseFloat(rec.buy) || 0;
  const cur = parseFloat(rec.cur) || 0;
  const value = qty * cur;
  // Only show a gain/loss once there's a real buy price — otherwise buy
  // falls back to 0 and the whole position value reads as "gain".
  const hasBuyPrice = buy > 0;
  const gain = qty * cur - qty * buy;
  const gainColor = gain >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
  const gainSign = gain >= 0 ? '+' : '−';

  return (
    <div ref={morphRef} style={{ display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeInvestDetail}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)', flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {isManual ? (
          <input
            className="input" autoFocus={!rec.name} placeholder="Investment name"
            style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
            value={rec.name}
            onChange={(e) => actions.setInvestDetailField(listKey, id, 'name', e.target.value)}
          />
        ) : (
          <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{rec.name}</span>
        )}
      </div>

      <AnimatedNumber
        className="type-numeric"
        style={{ fontWeight: 700, fontSize: 26, marginBottom: 4, display: 'block' }}
        value={value}
        format={money}
        prefix="RM "
      />
      <div className="type-numeric" style={{ fontSize: 12.5, fontWeight: 600, color: hasBuyPrice ? gainColor : 'var(--color-text-muted)', marginBottom: 20 }}>
        {hasBuyPrice ? `${gainSign}RM ${money(Math.abs(gain))} gain/loss` : 'Add a buy price to see gain/loss'}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Quantity / units</label>
        <button type="button" onClick={() => setKeypad('qty')} className="input" style={{ display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
          <span style={{ color: rec.qty ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{rec.qty ? formatWithCommas(rec.qty) : '0'}</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Buy price (RM)</label>
          <button type="button" onClick={() => setKeypad('buy')} className="input" style={{ display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
            <span style={{ color: rec.buy ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{rec.buy ? formatWithCommas(rec.buy) : '0.00'}</span>
          </button>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Current price (RM)</label>
          <button type="button" onClick={() => setKeypad('cur')} className="input" style={{ display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
            <span style={{ color: rec.cur ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{rec.cur ? formatWithCommas(rec.cur) : '0.00'}</span>
          </button>
        </div>
      </div>

      <AmountKeypadSheet
        open={keypad != null}
        value={keypad ? rec[keypad] : ''}
        onClose={() => setKeypad(null)}
        onSave={(v) => { if (keypad) actions.setInvestDetailField(listKey, id, keypad, v); }}
      />

      {isManual && (
        <button
          type="button"
          onClick={() => {
            const idx = state.ob.manual.investments.findIndex((r) => r.id === id);
            if (idx >= 0) actions.removeInvestmentRow(idx);
            actions.closeInvestDetail();
          }}
          className="pressable"
          style={{ all: 'unset', cursor: 'pointer', display: 'block', marginTop: 4, color: 'var(--color-danger-700)', font: '600 12.5px var(--font-body)' }}
        >
          Remove investment
        </button>
      )}
    </div>
  );
}
