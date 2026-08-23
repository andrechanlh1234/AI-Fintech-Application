import { useStore, useActions } from '../../store/StoreProvider';
import { money, isoToDisplayDate } from '../../lib/format';
import type { ManualData } from '../../store/types';
import type { BalanceEntry } from '../../lib/seedData';

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

  if (!state.balanceDetailOpen) return null;
  const sep = state.balanceDetailOpen.indexOf(':');
  const listKey = state.balanceDetailOpen.slice(0, sep);
  const id = state.balanceDetailOpen.slice(sep + 1);
  const rec = resolveRow(state, listKey, id);
  if (!rec) return null;

  const isManual = !listKey.startsWith('seed.');
  const balanceLabel = money(parseFloat(String(rec.amount)) || 0);
  const draft = state.balanceDraft;
  const isAdd = draft.mode !== 'deduct';
  const isDeduct = draft.mode === 'deduct';
  const history = (rec.history || []).slice().reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        {isManual ? (
          <input
            className="input" autoFocus={!rec.name} placeholder="Account name"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
            value={rec.name}
            onChange={(e) => actions.setRecordField(listKey as ManualListKey, id, 'name', e.target.value)}
          />
        ) : (
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>{rec.name}</span>
        )}
        <button
          type="button"
          onClick={actions.closeBalanceDetail}
          aria-label="Close"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 26, marginBottom: 20 }}>RM {balanceLabel}</div>

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
        <div className="field" style={{ flex: 1 }}>
          <label>Amount (RM)</label>
          <input className="input" value={draft.amount} onChange={(e) => actions.setBalanceDraftField('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="field" style={{ flex: 1 }}>
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
      {history.map((h) => {
        const descLabel = h.desc || (h.amount >= 0 ? 'Added' : 'Deducted');
        const dateLabel = isoToDisplayDate(h.date) || h.date || '—';
        const amountLabel = (h.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(h.amount));
        const amountColor = h.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
        return (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{descLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{dateLabel}</div>
            </div>
            <div className="type-numeric" style={{ fontSize: 13.5, fontWeight: 700, color: amountColor }}>{amountLabel}</div>
            <button
              type="button"
              onClick={() => actions.removeBalanceEntry(listKey, id, h.id)}
              aria-label="Remove"
              className="pressable"
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        );
      })}

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
