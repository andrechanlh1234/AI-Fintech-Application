// Ported from Cukai v7.dc.html lines 349-430 (obIsManualSetup).
import type { AppState } from '../../../store/types';
import type { ManualData } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { moneyWhole } from '../../../lib/format';
import { StepHeader, PlusIcon, XIcon } from './shared';

type Actions = ReturnType<typeof useActions>;
type RecordListKey = Exclude<keyof ManualData, 'investments'>;

function RecordRows({
  listKey, rows, actions, namePlaceholder, amountPlaceholder,
}: {
  listKey: RecordListKey; rows: ManualData[RecordListKey]; actions: Actions; namePlaceholder: string; amountPlaceholder: string;
}) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, padding: '10px 12px' }}>
          <input
            className="input" value={row.name} onChange={(e) => actions.setRecordField(listKey, row.id, 'name', e.target.value)}
            placeholder={namePlaceholder} style={{ flex: 1.3 }}
          />
          <input
            className="input" value={row.amount} onChange={(e) => actions.setRecordField(listKey, row.id, 'amount', e.target.value)}
            placeholder={amountPlaceholder} style={{ flex: 1 }}
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
  const totalLiabilities = sumOb(m.liabilities);
  const hasAnyInvestment = m.investments.some((r) => r.name);
  const investmentsValue = m.investments.reduce((s, r) => (r.name ? s + (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0) : s), 0);
  const investmentsGain = m.investments.reduce((s, r) => {
    if (!r.name) return s;
    const q = parseFloat(r.qty) || 0, b = parseFloat(r.buy) || 0, c = parseFloat(r.cur) || 0;
    return s + (q * c - q * b);
  }, 0);
  const investGainColor = investmentsGain >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
  const investGainSign = investmentsGain >= 0 ? '+' : '−';

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Enter your finances</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>A quick manual snapshot — you can refine this anytime.</div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Bank accounts</div>
      <RecordRows listKey="bankAccounts" rows={m.bankAccounts} actions={actions} namePlaceholder="Bank / account name" amountPlaceholder="Balance (RM)" />
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
            <input className="input" value={row.qty} onChange={(e) => actions.setInvestField(i, 'qty', e.target.value)} placeholder="Qty" style={{ flex: 1 }} />
            <input className="input" value={row.buy} onChange={(e) => actions.setInvestField(i, 'buy', e.target.value)} placeholder="Buy price" style={{ flex: 1 }} />
            <input className="input" value={row.cur} onChange={(e) => actions.setInvestField(i, 'cur', e.target.value)} placeholder="Current price" style={{ flex: 1 }} />
          </div>
        </div>
      ))}
      {hasAnyInvestment && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Total value RM {moneyWhole(investmentsValue)} · <span style={{ color: investGainColor }}>{investGainSign}RM {moneyWhole(Math.abs(investmentsGain))}</span>
        </div>
      )}

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Credit cards</div>
      <RecordRows listKey="creditCards" rows={m.creditCards} actions={actions} namePlaceholder="Card / bank name" amountPlaceholder="Outstanding (RM)" />
      <AddLink onClick={() => actions.addRecord('creditCards')} label="Add card" />
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>Total owed RM {moneyWhole(totalCcOwed)}</div>

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Properties</div>
      <RecordRows listKey="properties" rows={m.properties} actions={actions} namePlaceholder="e.g. Property 1" amountPlaceholder="Value (RM)" />
      <AddLink onClick={() => actions.addRecord('properties')} label="Add property" marginBottom={14} />

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Other assets</div>
      <RecordRows listKey="otherAssets" rows={m.otherAssets} actions={actions} namePlaceholder="e.g. Car, Gold" amountPlaceholder="Value (RM)" />
      <AddLink onClick={() => actions.addRecord('otherAssets')} label="Add asset" marginBottom={14} />

      <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>Liabilities</div>
      <RecordRows listKey="liabilities" rows={m.liabilities} actions={actions} namePlaceholder="e.g. Personal loan" amountPlaceholder="Amount owed (RM)" />
      <AddLink onClick={() => actions.addRecord('liabilities')} label="Add liability" />
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 8 }}>Total liabilities RM {moneyWhole(totalLiabilities)}</div>

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onContinue} className="btn btn-primary btn-lg">Continue</button>
    </div>
  );
}
