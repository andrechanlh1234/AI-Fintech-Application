import { useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { BottomSheet } from '../../components/BottomSheet';
import { moneyWhole } from '../../lib/format';

/** Offered right after a receipt is saved / a reviewed line accepted in a
 * spending category the user hasn't budgeted. Adds it to the Flexible
 * bucket so its spend shows on the Budgets screen; a monthly cap is
 * optional (0 = tracked, no limit yet). Gated on state.budgetPrompt. */
export function BudgetPromptSheet() {
  const { state } = useStore();
  const actions = useActions();
  const prompt = state.budgetPrompt;
  const [cap, setCap] = useState('');

  return (
    <BottomSheet open={!!prompt} onClose={actions.dismissBudgetPrompt}>
      <div style={{ padding: '12px 20px 24px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-300)', margin: '4px auto 18px' }} />
        {prompt && (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
              Track {prompt.cat} in your budget?
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 18 }}>
              You just logged RM {moneyWhole(prompt.amount)} of {prompt.cat} spending, but it isn’t a
              budget category yet — so it won’t show up on the Budgets screen. Add it now and this
              month’s spend starts counting straight away.
            </div>
            <div style={{ font: '600 12px var(--font-body)', marginBottom: 6 }}>Monthly budget (optional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>RM</span>
              <input
                className="input"
                inputMode="numeric"
                value={cap}
                onChange={(e) => setCap(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Leave blank to just track it"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={actions.dismissBudgetPrompt}
                className="btn btn-ghost btn-lg"
                style={{ flex: 1 }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => { actions.confirmBudgetPrompt(parseFloat(cap) || 0); setCap(''); }}
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
              >
                Add to budget
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
