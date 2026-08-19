// New onboarding step (not in the original design source) — added because
// finance.buckets starts completely empty for a fresh user, so the Home
// dashboard's "Monthly Budget" stayed at RM0/RM0 until the user separately
// discovered "Add category" on the Budgets screen. Reuses the exact same
// bucket/category actions the Budgets screen itself uses, so anything set
// here is the real thing, not a separate draft.
import type { AppState } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { StepHeader, PlusIcon, XIcon } from './shared';

type Actions = ReturnType<typeof useActions>;

const COMMON_CATEGORIES: Record<string, string[]> = {
  fixed: ['Housing', 'Utilities'],
  flexible: ['Food & Drink', 'Transport', 'Shopping'],
  goals: ['Emergency fund'],
  insurance: ['Medical Insurance'],
};

export function BudgetSetupStep({
  state, actions, progress, onBack, onSkip, onContinue,
}: {
  state: AppState; actions: Actions; progress: string; onBack: () => void; onSkip: () => void; onContinue: () => void;
}) {
  const totalPlan = state.finance.buckets.reduce((s, b) => s + b.categories.reduce((s2, c) => s2 + (c.cap || 0), 0), 0);

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Set up your budget</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>
        Add a few categories with a monthly target — you can add more or change these anytime in Finance → Budgets.
      </div>

      {state.finance.buckets.map((b) => (
        <div key={b.key} style={{ marginBottom: 18 }}>
          <div style={{ font: '600 12px var(--font-body)', marginBottom: 8 }}>{b.name}</div>
          {b.categories.map((c) => (
            <div key={c.id} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, padding: '10px 12px' }}>
              <input
                className="input" value={c.name} placeholder="Category name" style={{ flex: 1.3 }}
                onChange={(e) => actions.setBucketCategoryName(b.key, c.id, e.target.value)}
              />
              <input
                className="input" value={c.cap || ''} placeholder="Monthly cap (RM)" style={{ flex: 1 }}
                onChange={(e) => actions.setBucketCategoryCap(b.key, c.id, parseFloat(e.target.value) || 0)}
              />
              <button
                type="button" onClick={() => actions.removeBucketCategory(b.key, c.id)} aria-label="Remove" className="pressable"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}
              >
                <XIcon />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button" onClick={() => actions.addBucketCategory(b.key, undefined, false)} className="pressable"
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '4px 0' }}
            >
              <PlusIcon />Add category
            </button>
            {COMMON_CATEGORIES[b.key]?.filter((name) => !b.categories.some((c) => c.name === name)).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => actions.addBucketCategory(b.key, name, false)}
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 999, border: '1.5px solid var(--color-neutral-400)', fontSize: 11.5, color: 'var(--color-text-muted)' }}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {totalPlan > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Total monthly budget so far: <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>RM {totalPlan.toLocaleString()}</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 16 }} />
      <button type="button" onClick={onContinue} className="btn btn-primary btn-lg">Continue</button>
    </div>
  );
}
