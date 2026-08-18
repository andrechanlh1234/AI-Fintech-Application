import { useMemo, useRef } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectRecordPage } from '../../store/selectors';
import { money, signedMoney } from '../../lib/format';
import { rowBadge } from '../../lib/constants';

// Ported from Cukai v7.dc.html lines 1180-1230 ("All transactions" / Record screen).
// The day-strip calendar + selected-day summary is the source layout; the search
// input and category chips (selectRecordPage().categoryChips / filteredTx) are
// layered on top per the task spec — when a search term or a non-"All" filter is
// active, the filtered list replaces the day list.

type RecordTx = ReturnType<typeof selectRecordPage>['selectedDayTx'][number];

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

function TxRow({ tx }: { tx: RecordTx }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', margin: '0 -10px', borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--color-neutral-300)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 11.5, background: tx.badgeBg, color: tx.badgeFg }}>
        <TxIcon tx={tx} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tx.merchant}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{tx.catLabel} · {tx.payment}</div>
      </div>
      {tx.tax && <span className="tag tag-tax" style={{ flexShrink: 0 }}>Tax</span>}
      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0, color: tx.amountColor }}>{tx.amountLabel}</div>
    </div>
  );
}

export default function RecordSection() {
  const { state } = useStore();
  const actions = useActions();
  const railRef = useRef<HTMLDivElement>(null);
  const rec = selectRecordPage(state);

  const scrollCalendar = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  };

  const searchActive = !!state.txSearch || state.txFilter !== 'All';
  const netColor = rec.selectedDayNet >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)';

  const filteredTxDisplay = useMemo(() => rec.filteredTx.map((t) => ({
    ...t, ...rowBadge(t), catLabel: t.cat,
    amountLabel: (t.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(t.amount)),
    amountColor: t.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
  })), [rec.filteredTx]);

  return (
    <div className="screen-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button type="button" onClick={actions.goFinanceStats} aria-label="Back" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>All transactions</span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{rec.recordMonthLabel}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 18 }}>
        <button type="button" onClick={() => scrollCalendar(-1)} aria-label="Scroll earlier" className="pressable" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <div ref={railRef} className="no-scrollbar" style={{ display: 'flex', gap: 8, overflow: 'auto', flex: 1, padding: '2px 2px 4px', scrollBehavior: 'smooth' }}>
          {rec.calendarDays.map((d) => {
            const borderColor = d.isSelected ? 'var(--color-accent)' : 'var(--color-neutral-300)';
            const bg = d.isSelected ? 'var(--color-accent-100)' : 'var(--color-surface)';
            const weekdayColor = d.isSelected ? 'var(--color-accent-700)' : 'var(--color-text-muted)';
            const dayColor = d.isToday ? 'var(--color-accent-700)' : 'var(--color-text)';
            const dotColor = d.hasExpense ? 'var(--color-accent)' : 'transparent';
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => actions.selectRecordDay(d.month, d.day)}
                className="pressable"
                style={{ flexShrink: 0, width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '8px 0 7px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: `1.5px solid ${borderColor}`, background: bg }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: weekdayColor }}>{d.weekday}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: dayColor }}>{d.day}</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => scrollCalendar(1)} aria-label="Scroll later" className="pressable" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"></path></svg>
        </button>
      </div>

      <input
        type="text"
        placeholder="Search transactions"
        value={state.txSearch}
        onChange={(e) => actions.setTxSearch(e.target.value)}
        className="input"
        style={{ width: '100%', marginBottom: 10 }}
      />
      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {rec.categoryChips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => actions.setTxFilter(c)}
            className="pressable"
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              border: '1.5px solid', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0,
              background: state.txFilter === c ? 'var(--color-accent)' : 'var(--color-surface)',
              color: state.txFilter === c ? '#fff' : 'var(--color-text)',
              borderColor: state.txFilter === c ? 'var(--color-accent)' : 'var(--color-neutral-400)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {!searchActive && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>{rec.selectedDayLabel}</span>
            <span className="type-numeric" style={{ fontSize: 12.5, fontWeight: 700, color: netColor }}>{signedMoney(rec.selectedDayNet)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 4 }} />
          {rec.selectedDayTx.length > 0 ? (
            rec.selectedDayTx.map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <div style={{ padding: '24px 4px', fontSize: 14, color: 'var(--color-text-muted)' }}>No transactions on this day.</div>
          )}
        </>
      )}

      {searchActive && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17 }}>
              {filteredTxDisplay.length} result{filteredTxDisplay.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 4 }} />
          {filteredTxDisplay.length > 0 ? (
            filteredTxDisplay.map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <div style={{ padding: '24px 4px', fontSize: 14, color: 'var(--color-text-muted)' }}>No transactions match your search.</div>
          )}
        </>
      )}
    </div>
  );
}
