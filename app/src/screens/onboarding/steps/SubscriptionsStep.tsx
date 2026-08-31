// Ported from Cukai v7.dc.html lines 432-476 (obIsSubscriptions).
import type { AppState } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { subBadge, paymentMethodOptions, SUB_FREQUENCY_OPTIONS, SUB_CATEGORY_OPTIONS } from '../../../lib/constants';
import {
  money, moneyWhole, isoToDisplayDate,
  planPayoffDate, planProgressPct, planRemainingInstallments,
} from '../../../lib/format';
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
        if (s.kind === 'plan') {
          const total = Number(s.totalInstallments) || 0;
          const paid = Number(s.paidInstallments) || 0;
          const monthly = moneyWhole((parseFloat(s.amount) || 0));
          const payoffIso = planPayoffDate(s.startDate, total, s.frequency || 'Monthly');
          const doneLabel = payoffIso ? isoToDisplayDate(payoffIso).replace(/^\d+\s/, '') : '';
          const complete = s.archived || planRemainingInstallments(s) <= 0;
          return (
            <div key={s.name + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: b.bg, color: b.fg, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 13, marginTop: 2,
              }}>
                {b.letter}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 5 }}>
                  RM {monthly}/mo · {paid} of {total} paid{doneLabel ? ` · done ${doneLabel}` : ''}
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'var(--color-neutral-300)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(planProgressPct(s) * 100)}%`, background: 'var(--color-accent)' }} />
                </div>
                {!complete && (
                  <button
                    type="button"
                    onClick={() => actions.markPlanPaymentMade(i)}
                    className="pressable"
                    style={{ all: 'unset', cursor: 'pointer', marginTop: 6, color: 'var(--color-accent-700)', font: '700 11px var(--font-body)' }}
                  >
                    Mark payment made
                  </button>
                )}
              </div>
              <button
                type="button" onClick={() => actions.removeSubscription(i)} aria-label="Remove" className="pressable"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)', marginTop: 2 }}
              >
                <XIcon size={14} />
              </button>
            </div>
          );
        }
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
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.frequency} · {s.category}</div>
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

      <div className="card" style={{ margin: '14px 0', gap: 14 }}>
        <div style={{ font: '600 12px var(--font-body)' }}>Add a subscription</div>
        <div className="field">
          <label>Name</label>
          <input className="input" value={draft.name} onChange={(e) => actions.setSubDraft('name', e.target.value)} placeholder="e.g. Netflix" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Amount (RM)</label>
            <input className="input" inputMode="decimal" value={draft.amount} onChange={(e) => actions.setSubDraft('amount', e.target.value)} placeholder="e.g. 54.90" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Frequency</label>
            <select className="input" value={draft.frequency} onChange={(e) => actions.setSubDraft('frequency', e.target.value)}>
              {SUB_FREQUENCY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Payment method</label>
            <select className="input" value={draft.method} onChange={(e) => actions.setSubDraft('method', e.target.value)}>
              {paymentMethodOptions(state.ob.manual, draft.method).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Category</label>
            <select className="input" value={draft.category} onChange={(e) => actions.setSubDraft('category', e.target.value)}>
              {SUB_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <button type="button" onClick={actions.addSubscription} className="btn btn-secondary" style={{ marginTop: 2 }}>Add subscription</button>
      </div>

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onContinue} className="btn btn-primary btn-lg">Continue</button>
    </div>
  );
}
