// Ported from Cukai v7.dc.html lines 432-476 (obIsSubscriptions).
import type { AppState } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { subBadge, paymentMethodOptions, SUB_FREQUENCY_OPTIONS, SUB_CATEGORY_OPTIONS } from '../../../lib/constants';
import { money, isoToDisplayDate } from '../../../lib/format';
import { StepHeader, XIcon } from './shared';

type Actions = ReturnType<typeof useActions>;

export function SubscriptionsStep({
  state, actions, progress, onBack, onSkip, onContinue,
}: {
  state: AppState; actions: Actions; progress: string; onBack: () => void; onSkip: () => void; onContinue: () => void;
}) {
  const draft = state.ob.subDraft;

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Your subscriptions</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Add recurring subscriptions so we can track renewals and totals.
      </div>

      {state.ob.subs.map((s, i) => {
        const b = subBadge(s.name);
        return (
          <div key={s.name + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: b.bg, color: b.fg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 13,
            }}>
              {b.letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.frequency} · Next {isoToDisplayDate(s.nextPayment) || '—'}</div>
            </div>
            <div className="type-numeric" style={{ fontSize: 13, fontWeight: 600 }}>RM {money(parseFloat(s.amount) || 0)}</div>
            <button
              type="button" onClick={() => actions.removeSubscription(i)} aria-label="Remove" className="pressable"
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <XIcon size={14} />
            </button>
          </div>
        );
      })}

      <div className="card" style={{ margin: '14px 0', gap: 10 }}>
        <div style={{ font: '600 12px var(--font-body)' }}>Add a subscription</div>
        <input className="input" value={draft.name} onChange={(e) => actions.setSubDraft('name', e.target.value)} placeholder="Name (e.g. Netflix)" />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={draft.amount} onChange={(e) => actions.setSubDraft('amount', e.target.value)} placeholder="Amount (RM)" style={{ flex: 1 }} />
          <select className="input" value={draft.frequency} onChange={(e) => actions.setSubDraft('frequency', e.target.value)} style={{ flex: 1 }}>
            {SUB_FREQUENCY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="date" value={draft.startDate} onChange={(e) => actions.setSubDraft('startDate', e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="date" value={draft.nextPayment} onChange={(e) => actions.setSubDraft('nextPayment', e.target.value)} style={{ flex: 1 }} />
        </div>
        <select className="input" value={draft.method} onChange={(e) => actions.setSubDraft('method', e.target.value)}>
          {paymentMethodOptions(state.ob.manual, draft.method).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="input" value={draft.category} onChange={(e) => actions.setSubDraft('category', e.target.value)}>
          {SUB_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <button type="button" onClick={actions.addSubscription} className="btn btn-secondary" style={{ marginTop: 2 }}>Add subscription</button>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onContinue} className="btn btn-primary btn-lg">Continue</button>
    </div>
  );
}
