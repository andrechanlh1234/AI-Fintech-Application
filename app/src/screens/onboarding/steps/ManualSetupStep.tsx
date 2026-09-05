// Ported from Cukai v7.dc.html lines 349-430 (obIsManualSetup).
import { useState } from 'react';
import type { AppState } from '../../../store/types';
import type { ManualData } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { moneyWhole, formatWithCommas } from '../../../lib/format';
import { computeInvestmentsSummary } from '../../../lib/investments';
import { AmountKeypadSheet, KeypadField } from '../../../components/AmountKeypadSheet';
import { StepHeader, PlusIcon, XIcon } from './shared';

type Actions = ReturnType<typeof useActions>;
type RecordListKey = Exclude<keyof ManualData, 'investments'>;

// One badge glyph per list -- these rows have no per-item category the way
// transactions do, so the icon marks which section a row belongs to rather
// than anything the user chose.
const LIST_ICON: Record<RecordListKey, string> = {
  bankAccounts: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  creditCards: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  properties: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  otherAssets: '<path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  liabilities: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
};

function RowIcon({ listKey }: { listKey: RecordListKey }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: LIST_ICON[listKey] }} />
  );
}

// Compact inline amount for a list row: shows the comma-formatted value
// right-aligned, and opens the calculator keypad on tap (same keypad the
// receipt-scan amount uses) rather than a native decimal keyboard.
function AmountField({ value, onChange, placeholder }: { value: string; onChange: (raw: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          all: 'unset', flex: 1, textAlign: 'right', font: '700 14.5px var(--font-heading)',
          fontVariantNumeric: 'tabular-nums', minWidth: 0, cursor: 'pointer',
          color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
        }}
      >
        {value ? formatWithCommas(value) : placeholder}
      </button>
      <AmountKeypadSheet open={open} value={value} onClose={() => setOpen(false)} onSave={onChange} />
    </>
  );
}

function RecordRows({
  listKey, rows, actions, namePlaceholder, amountPlaceholder,
}: {
  listKey: RecordListKey; rows: ManualData[RecordListKey]; actions: Actions; namePlaceholder: string; amountPlaceholder: string;
}) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, padding: '10px 12px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
          }}>
            <RowIcon listKey={listKey} />
          </div>
          <input
            value={row.name} onChange={(e) => actions.setRecordField(listKey, row.id, 'name', e.target.value)}
            placeholder={namePlaceholder}
            style={{ all: 'unset', flex: 1.3, font: '600 14px var(--font-body)', color: 'var(--color-text)', minWidth: 0 }}
          />
          <span style={{ font: '600 12px var(--font-body)', color: 'var(--color-text-muted)', flexShrink: 0 }}>RM</span>
          <AmountField
            value={String(row.amount)}
            onChange={(v) => actions.setRecordField(listKey, row.id, 'amount', v)}
            placeholder={amountPlaceholder}
          />
          <button
            type="button" onClick={() => actions.removeRecord(listKey, row.id)} aria-label="Remove" className="pressable"
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            <XIcon />
          </button>
        </div>
      ))}
    </>
  );
}

function AddLink({ onClick, label, marginBottom = 6 }: { onClick: () => void; label: string; marginBottom?: number }) {
  return (
    <button
      type="button" onClick={onClick} className="pressable"
      style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '4px 0', marginBottom }}
    >
      <PlusIcon />{label}
    </button>
  );
}

function sumOb(rows: ManualData[RecordListKey]) {
  return rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
}

export function ManualSetupStep({
  state, actions, progress, onBack, onSkip, onContinue,
}: {
  state: AppState; actions: Actions; progress: string; onBack: () => void; onSkip: () => void; onContinue: () => void;
}) {
  const m = state.ob.manual;
  const totalCash = sumOb(m.bankAccounts);
  const totalCcOwed = sumOb(m.creditCards);
  const hasAnyInvestment = m.investments.some((r) => r.name);
  const { value: investmentsValue, gain: investmentsGain } = computeInvestmentsSummary(m.investments);
  const investGainColor = investmentsGain >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
  const investGainSign = investmentsGain >= 0 ? '+' : '−';

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Enter your finances</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>A quick manual snapshot — you can refine this anytime.</div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Bank accounts</div>
      <RecordRows listKey="bankAccounts" rows={m.bankAccounts} actions={actions} namePlaceholder="Bank / account name" amountPlaceholder="0.00" />
      <AddLink onClick={() => actions.addRecord('bankAccounts')} label="Add account" />
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>Total cash RM {moneyWhole(totalCash)}</div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Investments</div>
      {m.investments.map((row, i) => (
        <div key={row.id || i} className="card" style={{ marginBottom: 10, gap: 8 }}>
          <input
            className="input" value={row.name} onChange={(e) => actions.setInvestField(i, 'name', e.target.value)}
            placeholder="Investment name (e.g. Apple stock, BTC)"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <KeypadField value={row.qty} onSave={(v) => actions.setInvestField(i, 'qty', v)} placeholder="Qty" style={{ flex: 1 }} />
            <KeypadField value={row.buy} onSave={(v) => actions.setInvestField(i, 'buy', v)} placeholder="Buy price" style={{ flex: 1 }} />
            <KeypadField value={row.cur} onSave={(v) => actions.setInvestField(i, 'cur', v)} placeholder="Current price" style={{ flex: 1 }} />
          </div>
        </div>
      ))}
      {hasAnyInvestment && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Total value RM {moneyWhole(investmentsValue)} · <span style={{ color: investGainColor }}>{investGainSign}RM {moneyWhole(Math.abs(investmentsGain))}</span>
        </div>
      )}

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Credit cards</div>
      <RecordRows listKey="creditCards" rows={m.creditCards} actions={actions} namePlaceholder="Card / bank name" amountPlaceholder="0.00" />
      <AddLink onClick={() => actions.addRecord('creditCards')} label="Add card" />
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>Total owed RM {moneyWhole(totalCcOwed)}</div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Properties</div>
      <RecordRows listKey="properties" rows={m.properties} actions={actions} namePlaceholder="e.g. Property 1" amountPlaceholder="0.00" />
      <AddLink onClick={() => actions.addRecord('properties')} label="Add property" marginBottom={14} />

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onContinue} className="btn btn-primary btn-lg">Continue</button>
    </div>
  );
}
