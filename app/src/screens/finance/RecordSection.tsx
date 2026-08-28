import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectRecordPage } from '../../store/selectors';
import { signedMoney, isoToDisplayDate, todayIso, daysAgoIso } from '../../lib/format';
import { FilterPicker } from '../../components/FilterPicker';
import { DateRangeSheet } from '../../components/DateRangeSheet';
import { TransactionRow } from '../../components/TransactionRow';
import { prefersReducedMotion, SPRING_SOFT, DUR } from '../../lib/motion';

// Ported from Cukai v7.dc.html lines 1180-1230 ("All transactions" / Record screen).
// The day-strip calendar + selected-day summary is the source layout; the search
// input and category chips (selectRecordPage().categoryChips / filteredTx) are
// layered on top per the task spec — when a search term or a non-"All" filter is
// active, the filtered list replaces the day list.


const DEFAULT_RECORD_FROM = daysAgoIso(29);

export default function RecordSection() {
  const { state } = useStore();
  const actions = useActions();
  const statementInputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rec = selectRecordPage(state);

  // Transaction insert + FLIP (spec §8): a row that appears for the first
  // time flies up from the "Add transaction" button and expands into place;
  // rows it pushes down glide to their new positions rather than jumping.
  const listRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const rows = container.querySelectorAll<HTMLElement>('[data-txrow]');
    const curr = new Map<string, DOMRect>();
    rows.forEach((el) => curr.set(el.dataset.txrow as string, el.getBoundingClientRect()));
    const prev = prevRects.current;
    const hadPrev = prev.size > 0;
    if (hadPrev && !prefersReducedMotion()) {
      const newIds: string[] = [];
      curr.forEach((_r, id) => { if (!prev.has(id)) newIds.push(id); });
      // A genuine insert adds one or two rows on top of what was there; a
      // filter/search change swaps out the whole list — only the former
      // flies up from the "+" button, the latter just FLIP-shifts.
      const isInsert = newIds.length > 0 && newIds.length <= 2 && curr.size >= prev.size;
      const btn = addBtnRef.current?.getBoundingClientRect();
      rows.forEach((el) => {
        const id = el.dataset.txrow as string;
        const before = prev.get(id);
        const after = curr.get(id)!;
        if (!before) {
          if (!isInsert) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR.pop, easing: 'ease' }); return; }
          const dy = btn ? btn.top - after.top : -12;
          el.animate(
            [{ opacity: 0, transform: `translateY(${dy}px) scale(0.92)` }, { opacity: 1, transform: 'none' }],
            { duration: DUR.page, easing: SPRING_SOFT },
          );
          return;
        }
        const shift = before.top - after.top;
        if (Math.abs(shift) > 0.5) {
          el.animate(
            [{ transform: `translateY(${shift}px)` }, { transform: 'none' }],
            { duration: DUR.page, easing: SPRING_SOFT },
          );
        }
      });
    }
    prevRects.current = curr;
  });

  const handleStatementFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file still fires onChange
    if (file) actions.uploadStatementFile(file);
  };

  const rangeLabel = `${isoToDisplayDate(state.recordDateFrom).replace(/ \d{4}$/, '')} – ${isoToDisplayDate(state.recordDateTo).replace(/ \d{4}$/, '')}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={actions.goFinanceStats} aria-label="Back" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, flex: 1 }}>All transactions</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <button
          ref={addBtnRef}
          type="button"
          onClick={() => { actions.openScan(); actions.chooseManual(); }}
          className="pressable"
          style={{
            all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', borderRadius: 'var(--radius-md)', font: '600 11.5px var(--font-body)',
            border: '1.5px solid var(--color-accent-300)', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path><path d="M12 5v14"></path>
          </svg>
          Add transaction
        </button>
        <button
          type="button"
          onClick={() => statementInputRef.current?.click()}
          disabled={state.statementUploading}
          className="pressable"
          style={{
            all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: state.statementUploading ? 'default' : 'pointer',
            padding: '6px 10px', borderRadius: 'var(--radius-md)', font: '600 11.5px var(--font-body)',
            border: '1.5px solid var(--color-neutral-400)', background: 'var(--color-surface)', color: 'var(--color-accent-700)',
            opacity: state.statementUploading ? 0.6 : 1,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path><path d="M12 5v14"></path>
          </svg>
          {state.statementUploading ? 'Importing…' : 'Import statement'}
        </button>
        <input ref={statementInputRef} type="file" accept=".csv,.pdf" onChange={handleStatementFile} style={{ display: 'none' }} />
      </div>

      {state.statementUploadError && (
        <div style={{ fontSize: 12.5, color: 'var(--color-danger-700)', marginBottom: 10 }}>{state.statementUploadError}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 11px', borderRadius: 999, font: '500 11.5px var(--font-body)', whiteSpace: 'nowrap',
              border: '1.5px solid var(--color-accent)', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
            }}
          >
            {rangeLabel}
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filter by date"
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 999, color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--color-neutral-400)', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" />
              <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" />
              <line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="18" r="2" />
            </svg>
          </button>
        </div>
        {/* Search on the left, filter on the right — one row, matched height. */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
          <input
            type="text"
            placeholder="Search transactions"
            value={state.txSearch}
            onChange={(e) => actions.setTxSearch(e.target.value)}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <FilterPicker
            value={state.txFilter}
            options={rec.categoryChips.filter((c) => c !== 'All')}
            onChange={actions.setTxFilter}
            align="right"
            triggerStyle={{
              display: 'flex', padding: '0 14px', height: '100%', minHeight: 36, boxSizing: 'border-box',
              borderRadius: 'var(--radius-md)', font: '500 12px var(--font-body)',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>
          {rec.rangeCount} result{rec.rangeCount === 1 ? '' : 's'}
        </span>
        <span className="type-numeric" style={{ fontSize: 12.5, fontWeight: 700, color: rec.rangeNet >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)' }}>
          {signedMoney(rec.rangeNet)}
        </span>
      </div>
      <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 4 }} />
      <div ref={listRef}>
        {rec.groupedTx.length > 0 ? (
          rec.groupedTx.map((group) => (
            <div key={group.iso}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '14px 0 4px' }}>
                {group.label}
              </div>
              {group.items.map((tx) => (
                <div key={tx.id} data-txrow={String(tx.id)}>
                  <TransactionRow
                    tx={tx}
                    subtitle={`${tx.catLabel} · ${tx.payment}`}
                    onOpen={String(tx.id).startsWith('bud-') ? undefined : () => actions.openTxDetail(tx.id)}
                    showTaxTag
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          <div style={{ padding: '24px 4px', fontSize: 14, color: 'var(--color-text-muted)' }}>No transactions in this range.</div>
        )}
      </div>

      <DateRangeSheet
        open={sheetOpen}
        from={state.recordDateFrom}
        to={state.recordDateTo}
        defaultFrom={DEFAULT_RECORD_FROM}
        defaultTo={todayIso()}
        onChange={actions.setRecordRange}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
