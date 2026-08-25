import { useRef, useState, type ChangeEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectRecordPage } from '../../store/selectors';
import { signedMoney, isoToDisplayDate, todayIso, daysAgoIso } from '../../lib/format';
import { FilterPicker } from '../../components/FilterPicker';
import { DateRangeSheet } from '../../components/DateRangeSheet';
import { TransactionRow } from '../../components/TransactionRow';

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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => { actions.openScan(); actions.chooseManual(); }}
          className="pressable"
          style={{
            all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-md)', font: '600 12.5px var(--font-body)',
            border: '1.5px solid var(--color-accent-300)', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
            all: 'unset', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: state.statementUploading ? 'default' : 'pointer',
            padding: '8px 12px', borderRadius: 'var(--radius-md)', font: '600 12.5px var(--font-body)',
            border: '1.5px solid var(--color-neutral-400)', background: 'var(--color-surface)', color: 'var(--color-accent-700)',
            opacity: state.statementUploading ? 0.6 : 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 999, font: '500 12.5px var(--font-body)', whiteSpace: 'nowrap',
              border: '1.5px solid var(--color-accent)', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
            }}
          >
            {rangeLabel}
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filter by date"
            className="pressable"
            style={{
              all: 'unset', cursor: 'pointer', width: 34, height: 34, borderRadius: 999, color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--color-neutral-400)', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" />
              <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" />
              <line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="18" r="2" />
            </svg>
          </button>
          <FilterPicker
            value={state.txFilter}
            options={rec.categoryChips.filter((c) => c !== 'All')}
            onChange={actions.setTxFilter}
          />
        </div>
        <input
          type="text"
          placeholder="Search transactions"
          value={state.txSearch}
          onChange={(e) => actions.setTxSearch(e.target.value)}
          className="input"
        />
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
      {rec.groupedTx.length > 0 ? (
        rec.groupedTx.map((group) => (
          <div key={group.iso}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '14px 0 4px' }}>
              {group.label}
            </div>
            {group.items.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                subtitle={`${tx.catLabel} · ${tx.payment}`}
                onOpen={String(tx.id).startsWith('bud-') ? undefined : () => actions.openTxDetail(tx.id)}
                showTaxTag
              />
            ))}
          </div>
        ))
      ) : (
        <div style={{ padding: '24px 4px', fontSize: 14, color: 'var(--color-text-muted)' }}>No transactions in this range.</div>
      )}

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
