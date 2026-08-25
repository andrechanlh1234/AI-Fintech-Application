import { useRef, useState, type ChangeEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectRecordPage } from '../../store/selectors';
import { signedMoney, isoToDisplayDate, todayIso, daysAgoIso } from '../../lib/format';
import { FilterPicker } from '../../components/FilterPicker';
import { DateRangeSheet } from '../../components/DateRangeSheet';

// Ported from Cukai v7.dc.html lines 1180-1230 ("All transactions" / Record screen).
// The day-strip calendar + selected-day summary is the source layout; the search
// input and category chips (selectRecordPage().categoryChips / filteredTx) are
// layered on top per the task spec — when a search term or a non-"All" filter is
// active, the filtered list replaces the day list.

type RecordTx = ReturnType<typeof selectRecordPage>['groupedTx'][number]['items'][number];

function TxIcon({ tx }: { tx: RecordTx }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tx.hasBrand) return <>{tx.badgeLetter}</>;
  if (tx.isCar) return (
    <svg {...common}><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"></path><circle cx="6.5" cy="16.5" r="2.5"></circle><circle cx="16.5" cy="16.5" r="2.5"></circle></svg>
  );
  if (tx.isCoffee) return (
    <svg {...common}><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line></svg>
  );
  if (tx.isBag) return (
    <svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
  );
  if (tx.isZap) return (
    <svg {...common}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>
  );
  if (tx.isMedical) return (
    <svg {...common}><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
  );
  if (tx.isBook) return (
    <svg {...common}><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>
  );
  if (tx.isArrowUp) return (
    <svg {...common} stroke="var(--color-accent-700)"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg>
  );
  return null;
}

function TxRow({ tx, onOpen }: { tx: RecordTx; onOpen: () => void }) {
  // Budget-line-item rows ("bud-…") are a display overlay from
  // state.finance.buckets, not real state.transactions entries -- editing
  // those lives in the Budgets screen's own category editor, not here, so
  // only a real transaction row opens the edit/delete sheet.
  const editable = !String(tx.id).startsWith('bud-');
  return (
    <button
      type="button"
      onClick={editable ? onOpen : undefined}
      className="pressable"
      style={{ all: 'unset', cursor: editable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', margin: '0 -10px', width: 'calc(100% + 20px)', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--color-neutral-300)' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 11.5, background: tx.badgeBg, color: tx.badgeFg }}>
        <TxIcon tx={tx} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tx.merchant}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{tx.catLabel} · {tx.payment}</div>
      </div>
      {tx.tax && <span className="tag tag-tax" style={{ flexShrink: 0 }}>Tax</span>}
      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0, color: tx.amountColor }}>{tx.amountLabel}</div>
    </button>
  );
}

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
            {group.items.map((tx) => <TxRow key={tx.id} tx={tx} onOpen={() => actions.openTxDetail(tx.id)} />)}
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
