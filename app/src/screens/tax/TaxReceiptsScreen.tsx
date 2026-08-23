import { useMemo, useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectTaxCenter } from '../../store/selectors';
import { money } from '../../lib/format';

// Reached from Tax Center's "See all" link once there are more receipts
// than the inline preview shows -- a dedicated place to search/filter the
// full log instead of crowding the main screen. Same tax.taxReceiptsAll
// data as the preview, just unsliced.
export function TaxReceiptsScreen() {
  const { state } = useStore();
  const actions = useActions();
  const tax = selectTaxCenter(state);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const reliefChips = useMemo(() => ['All', ...Array.from(new Set(tax.taxReceiptsAll.map((r) => r.itemLabel)))], [tax.taxReceiptsAll]);
  const filtered = tax.taxReceiptsAll.filter((r) => {
    if (filter !== 'All' && r.itemLabel !== filter) return false;
    if (search && !r.merchant.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeTaxReceipts}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)', flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, flex: 1 }}>Tax Receipts</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tax.taxReceiptsAll.length} total</span>
      </div>

      <input
        type="text"
        placeholder="Search receipts"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
        style={{ width: '100%', marginBottom: 10 }}
      />

      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {reliefChips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className="pressable"
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', font: '600 12px var(--font-body)', whiteSpace: 'nowrap',
              background: filter === c ? 'var(--color-accent)' : 'var(--color-neutral-200)', color: filter === c ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', padding: '6px 0 18px' }}>No receipts match.</div>
      )}
      <div className="card" style={{ padding: '4px 14px' }}>
        {filtered.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--color-neutral-300)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{r.itemLabel} · {r.dateLabel}</div>
            </div>
            <div className="type-numeric" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>RM {money(r.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
