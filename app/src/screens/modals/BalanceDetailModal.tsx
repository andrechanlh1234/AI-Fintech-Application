import { useEffect, useRef } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { money } from '../../lib/format';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { playSharedMorph } from '../../lib/motion';
import type { ManualData } from '../../store/types';
import type { BalanceEntry } from '../../lib/seedData';
import { HistoryRow } from './HistoryRow';

const HISTORY_PREVIEW_COUNT = 3;

type ManualListKey = Exclude<keyof ManualData, 'investments'>;

interface BalRow { id: string; name: string; amount: string | number; history?: BalanceEntry[] }

function resolveRow(state: ReturnType<typeof useStore>['state'], listKey: string, id: string): BalRow | null {
  if (listKey.startsWith('seed.')) {
    const seedKey = listKey.slice(5) as 'cash' | 'creditCards' | 'investments';
    const list = state.netWorthSeed[seedKey] as unknown as BalRow[];
    return list.find((r) => r.id === id) || null;
  }
  const list = state.ob.manual[listKey as keyof ManualData] as unknown as BalRow[];
  return (list && list.find((r) => r.id === id)) || null;
}

export function BalanceDetailModal() {
  const { state } = useStore();
  const actions = useActions();
  const morphRef = useRef<HTMLDivElement>(null);
  useEffect(() => { playSharedMorph(morphRef.current); }, []);

  if (!state.balanceDetailOpen) return null;
  const sep = state.balanceDetailOpen.indexOf(':');
  const listKey = state.balanceDetailOpen.slice(0, sep);
  const id = state.balanceDetailOpen.slice(sep + 1);
  const rec = resolveRow(state, listKey, id);
  if (!rec) return null;

  const isManual = !listKey.startsWith('seed.');
  const balanceValue = parseFloat(String(rec.amount)) || 0;
  const draft = state.balanceDraft;
  const isAdd = draft.mode !== 'deduct';
  const isDeduct = draft.mode === 'deduct';
  const history = (rec.history || []).slice().reverse();
  const previewHistory = history.slice(0, HISTORY_PREVIEW_COUNT);

  return (
    <div ref={morphRef} style={{ display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeBalanceDetail}
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
            className="input" autoFocus={!rec.name} placeholder="Account name"
            style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
            value={rec.name}
            onChange={(e) => actions.setRecordField(listKey as ManualListKey, id, 'name', e.target.value)}
          />
        ) : (
          <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{rec.name}</span>
        )}
      </div>

      <AnimatedNumber
        className="type-numeric"
        style={{ fontWeight: 700, fontSize: 26, marginBottom: 20, display: 'block' }}
        value={balanceValue}
        format={money}
        prefix="RM "
      />

      <div className="seg" style={{ marginBottom: 14, width: '100%' }}>
        <label
          className="seg-opt"
          style={{ flex: 1, justifyContent: 'center', background: isAdd ? 'var(--color-accent)' : 'transparent', color: isAdd ? '#fff' : 'var(--color-text)' }}
        >
          <input type="radio" name="balMode" checked={isAdd} onChange={() => actions.setBalanceDraftField('mode', 'add')} />
          Add money
        </label>
        <label
          className="seg-opt"
          style={{ flex: 1, justifyContent: 'center', background: isDeduct ? 'var(--color-danger)' : 'transparent', color: isDeduct ? '#fff' : 'var(--color-text)' }}
        >
          <input type="radio" name="balMode" checked={isDeduct} onChange={() => actions.setBalanceDraftField('mode', 'deduct')} />
          Deduct money
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {/* Uneven split, not flex:1 each -- a native date input needs more
            room than a short amount field (day/month/year plus the
            browser's own calendar-picker icon), so an even 50/50 split left
            it cramped right up against its own right edge. */}
        <div className="field" style={{ flex: 4 }}>
          <label>Amount (RM)</label>
          <input className="input" value={draft.amount} onChange={(e) => actions.setBalanceDraftField('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="field" style={{ flex: 5 }}>
          <label>Date</label>
          <input className="input" type="date" value={draft.date} onChange={(e) => actions.setBalanceDraftField('date', e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Description</label>
        <input className="input" value={draft.desc} onChange={(e) => actions.setBalanceDraftField('desc', e.target.value)} placeholder="e.g. Salary, Transfer" />
      </div>

      <button type="button" onClick={() => actions.submitBalanceEntry(listKey, id)} className="btn btn-primary" style={{ marginBottom: 24 }}>
        Save
      </button>

      <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>History</div>
      {history.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No changes yet</div>}
      {previewHistory.map((h) => (
        <HistoryRow key={h.id} entry={h} onRemove={() => actions.removeBalanceEntry(listKey, id, h.id)} />
      ))}
      {history.length > HISTORY_PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => actions.openHistory(listKey, id)}
          className="pressable"
          style={{ all: 'unset', cursor: 'pointer', display: 'block', marginTop: 10, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)' }}
        >
          See all ({history.length}) →
        </button>
      )}

      {isManual && (
        <button
          type="button"
          onClick={() => { actions.removeRecord(listKey as ManualListKey, id); actions.closeBalanceDetail(); }}
          className="pressable"
          style={{ all: 'unset', cursor: 'pointer', display: 'block', marginTop: 20, color: 'var(--color-danger-700)', font: '600 12.5px var(--font-body)' }}
        >
          Remove account
        </button>
      )}
    </div>
  );
}
