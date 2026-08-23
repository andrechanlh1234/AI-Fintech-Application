import { useStore, useActions } from '../../store/StoreProvider';
import type { ManualData } from '../../store/types';
import type { BalanceEntry } from '../../lib/seedData';
import { HistoryRow } from './HistoryRow';

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

// Reached from BalanceDetailModal's "See all" link once an account has more
// than a handful of entries -- keeps the account screen itself from getting
// crowded while still giving the full log its own dedicated place.
export function HistoryScreen() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.historyOpen) return null;
  const sep = state.historyOpen.indexOf(':');
  const listKey = state.historyOpen.slice(0, sep);
  const id = state.historyOpen.slice(sep + 1);
  const rec = resolveRow(state, listKey, id);
  if (!rec) return null;

  const history = (rec.history || []).slice().reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeHistory}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)', flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>History</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>{rec.name}</div>

      {history.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No changes yet</div>}
      {history.map((h) => (
        <HistoryRow key={h.id} entry={h} onRemove={() => actions.removeBalanceEntry(listKey, id, h.id)} />
      ))}
    </div>
  );
}
