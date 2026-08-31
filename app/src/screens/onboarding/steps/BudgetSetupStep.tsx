// Onboarding "Set your monthly budget" step — income-anchored auto-split.
//
// A fresh user's finance.buckets start empty, so the Home dashboard's
// "Monthly Budget" card stays at RM0 until they discover "Add category" on
// the Budgets screen. This step seeds a plausible plan in one screen: it
// starts from the user's income, splits it 50 / 30 / 20 across
// Needs / Lifestyle / Savings (nudged by their primary goal), and lets them
// tap any figure to adjust. Everything is written through the exact same
// bucket/category actions the Budgets screen uses, so what's set here is the
// real budget, not a separate draft.
import { useState } from 'react';
import type { AppState } from '../../../store/types';
import type { useActions } from '../../../store/StoreProvider';
import { StepHeader } from './shared';
import { BUDGET_COMMON_CATEGORIES, BUDGET_TEMPLATES } from '../../../lib/constants';
import { estimateAnnualIncome } from '../../../lib/taxEngine';
import { moneyWhole } from '../../../lib/format';
import { KeypadField } from '../../../components/AmountKeypadSheet';
import { BudgetBucketRow } from '../../../components/BudgetBucketRow';

type Actions = ReturnType<typeof useActions>;
type BK = 'fixed' | 'flexible' | 'goals';
interface Rows { needs: number; lifestyle: number; savings: number }

const BUCKETS: { key: BK; rowKey: keyof Rows; name: string; examples: string; catchAll: string }[] = [
  { key: 'fixed', rowKey: 'needs', name: 'Needs', examples: 'Rent, utilities, insurance, loans', catchAll: 'Bills & essentials' },
  { key: 'flexible', rowKey: 'lifestyle', name: 'Lifestyle', examples: 'Food, transport, shopping, fun', catchAll: 'Everyday spending' },
  { key: 'goals', rowKey: 'savings', name: 'Savings & goals', examples: 'Emergency fund, investments, big purchases', catchAll: 'Savings' },
];

const round10 = (n: number) => Math.round(n / 10) * 10;

// The base 50/30/20 split plus the primary-goal nudge, rounded to RM10 with
// the rounding remainder parked in Needs. A savings target, when given, is
// honoured exactly and the rest split 60/40 Needs/Lifestyle.
function computeTemplate(income: number, goal: string | null, savingsTarget: number): Rows {
  if (income <= 0) return { needs: 0, lifestyle: 0, savings: 0 };
  if (savingsTarget > 0) {
    const savings = Math.min(Math.round(savingsTarget), income);
    const remainder = Math.max(0, income - savings);
    const lifestyle = Math.max(0, round10(remainder * 0.4));
    const needs = Math.max(0, income - savings - lifestyle);
    return { needs, lifestyle, savings };
  }
  const { base, goalNudges } = BUDGET_TEMPLATES;
  const nudge = (goal && goalNudges[goal]) || { needs: 0, lifestyle: 0, savings: 0 };
  const lifestyle = Math.max(0, round10(income * (base.lifestyle + nudge.lifestyle)));
  const savings = Math.max(0, round10(income * (base.savings + nudge.savings)));
  const needs = Math.max(0, income - lifestyle - savings);
  return { needs, lifestyle, savings };
}

export function BudgetSetupStep({
  state, actions, progress, onBack, onSkip, onContinue,
}: {
  state: AppState; actions: Actions; progress: string; onBack: () => void; onSkip: () => void; onContinue: () => void;
}) {
  const ob = state.ob;

  // `primaryGoal` is set by a parallel change and may be absent in older
  // state — fall back to the first entry of the legacy `goals[]` array.
  const goalsArr = Array.isArray(ob.goals) ? ob.goals.filter((g): g is string => typeof g === 'string') : [];
  const obExtra = ob as { primaryGoal?: unknown };
  const primaryGoal: string | null =
    typeof obExtra.primaryGoal === 'string' && obExtra.primaryGoal.trim()
      ? obExtra.primaryGoal
      : goalsArr.length > 0 ? goalsArr[0] : null;

  const savingsTargetNum = Math.max(0, parseFloat(String(ob.savingsTarget ?? '').replace(/[, ]/g, '')) || 0);
  // "Just track my spending" as the sole intent → no prescriptive split.
  const trackOnly = primaryGoal === 'Just track my spending' && savingsTargetNum <= 0 && goalsArr.length <= 1;

  const monthlyFromRange = (() => {
    const annual = estimateAnnualIncome(ob.approxIncome || ob.income);
    return Number.isFinite(annual) && annual > 0 ? annual / 12 : 0;
  })();

  // Re-entry snapshot: if the user already pressed Continue once and came
  // back, finance.buckets already carries their categories — rebuild the row
  // amounts from the existing caps and never re-apply the template.
  const [snapshot] = useState(() => {
    const sums: Record<BK, number> = { fixed: 0, flexible: 0, goals: 0 };
    let preExisting = false;
    for (const b of state.finance.buckets) {
      if (b.key === 'fixed' || b.key === 'flexible' || b.key === 'goals') {
        for (const c of b.categories) { sums[b.key] += Math.max(0, c.cap || 0); preExisting = true; }
      }
    }
    return { sums, preExisting };
  });

  const [income, setIncome] = useState(() => (monthlyFromRange > 0 ? String(Math.round(monthlyFromRange)) : ''));
  const parsedIncome = Math.max(0, Math.round(parseFloat(income) || 0));

  // Explicit per-row figures the user set with the steppers / keypad. Anything
  // not overridden follows the live auto-split below.
  const [rowOverrides, setRowOverrides] = useState<Partial<Rows>>({});

  // Category disclosure — per-bucket cap overrides, kept in local state and
  // only committed on Save.
  const [showCats, setShowCats] = useState(false);
  const [catCaps, setCatCaps] = useState<Record<BK, Record<string, string>>>({ fixed: {}, flexible: {}, goals: {} });
  const [catTouched, setCatTouched] = useState<Record<BK, boolean>>({ fixed: false, flexible: false, goals: false });

  // The auto-split, derived every render: frozen to the existing caps on
  // re-entry, empty for a pure tracker, otherwise recomputed from the current
  // income so it tracks edits to the take-home figure until a row is nudged.
  const templateRows: Rows = snapshot.preExisting
    ? { needs: snapshot.sums.fixed, lifestyle: snapshot.sums.flexible, savings: snapshot.sums.goals }
    : trackOnly
      ? { needs: 0, lifestyle: 0, savings: 0 }
      : computeTemplate(parsedIncome, primaryGoal, savingsTargetNum);

  const catSum = (bk: BK) => Object.values(catCaps[bk]).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const amountFor = (bk: BK, rowKey: keyof Rows) =>
    catTouched[bk] ? Math.round(catSum(bk)) : (rowOverrides[rowKey] ?? templateRows[rowKey]);

  const amounts: Record<BK, number> = {
    fixed: amountFor('fixed', 'needs'),
    flexible: amountFor('flexible', 'lifestyle'),
    goals: amountFor('goals', 'savings'),
  };
  const planTotal = amounts.fixed + amounts.flexible + amounts.goals;
  const left = parsedIncome - planTotal;
  const categoriesTouched = catTouched.fixed || catTouched.flexible || catTouched.goals;

  const setRow = (rowKey: keyof Rows, bk: BK, next: number) => {
    if (catTouched[bk]) setCatTouched((p) => ({ ...p, [bk]: false }));
    setRowOverrides((p) => ({ ...p, [rowKey]: Math.max(0, Math.round(next)) }));
  };

  const setCatCap = (bk: BK, name: string, raw: string) => {
    setCatCaps((p) => ({ ...p, [bk]: { ...p[bk], [name]: raw } }));
    setCatTouched((p) => (p[bk] ? p : { ...p, [bk]: true }));
  };

  const handleSave = () => {
    if (snapshot.preExisting) {
      // Preserve what's there; only realign single-category buckets to the
      // (possibly nudged) row figure, and seed a catch-all into a bucket
      // that somehow has none.
      for (const b of state.finance.buckets) {
        if (b.key !== 'fixed' && b.key !== 'flexible' && b.key !== 'goals') continue;
        const bk = b.key;
        const target = amounts[bk];
        if (b.categories.length === 1) {
          actions.setBucketCategoryCap(bk, b.categories[0].id, target);
        } else if (b.categories.length === 0 && target > 0) {
          actions.addBucketCategory(bk, BUCKETS.find((m) => m.key === bk)!.catchAll, false, target);
        }
      }
      onContinue();
      return;
    }

    if (!categoriesTouched) {
      if (planTotal > 0) {
        for (const meta of BUCKETS) {
          if (amounts[meta.key] > 0) actions.addBucketCategory(meta.key, meta.catchAll, false, amounts[meta.key]);
        }
      }
      onContinue();
      return;
    }

    for (const meta of BUCKETS) {
      if (catTouched[meta.key]) {
        for (const [nm, raw] of Object.entries(catCaps[meta.key])) {
          const cap = Math.round(parseFloat(raw) || 0);
          if (cap > 0) actions.addBucketCategory(meta.key, nm, false, cap);
        }
      } else if (amounts[meta.key] > 0) {
        // Bucket the user didn't open in the disclosure — keep its money via
        // a catch-all rather than dropping it silently.
        actions.addBucketCategory(meta.key, meta.catchAll, false, amounts[meta.key]);
      }
    }
    onContinue();
  };

  const showSummary = parsedIncome > 0;
  const templateApplied = !snapshot.preExisting && !trackOnly && parsedIncome > 0 && !!primaryGoal;

  let leftColor = 'var(--color-text-muted)';
  let leftText = `RM ${moneyWhole(left)} left to budget`;
  if (left === 0) { leftColor = 'var(--color-accent)'; leftText = 'RM 0 left to budget'; }
  else if (left < 0) { leftColor = 'var(--color-danger-700)'; leftText = `RM ${moneyWhole(Math.abs(left))} over your income`; }

  const subtext = trackOnly
    ? 'Estimate what you usually spend in each area, or skip and set this up later.'
    : parsedIncome > 0
      ? "We'll start from your income and split it into a simple plan. Nudge anything you like — your transactions fine-tune it after you connect an account."
      : "Tell us your monthly take-home pay and we'll suggest a plan — or just set each area yourself.";

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <StepHeader progress={progress} onBack={onBack} onSkip={onSkip} />

      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 23, marginBottom: 6 }}>Set your monthly budget</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18, lineHeight: 1.5 }}>{subtext}</div>

      <div className="field" style={{ marginBottom: 6 }}>
        <label>Monthly take-home pay</label>
        <KeypadField value={income} onSave={(raw) => setIncome(raw)} placeholder="e.g. 5,000" />
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 18, lineHeight: 1.45 }}>
        What actually lands in your account, after tax and EPF.
      </div>

      {showSummary && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="type-numeric" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19 }}>
            RM {moneyWhole(planTotal)} planned
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: leftColor }}>{leftText}</div>
        </div>
      )}

      {templateApplied && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.45 }}>
          Based on your goal to {primaryGoal!.toLowerCase()}, we&rsquo;ve started you with a savings-forward plan. Change anything you like.
        </div>
      )}

      {BUCKETS.map((meta) => (
        <BudgetBucketRow
          key={meta.key}
          name={meta.name}
          examples={meta.examples}
          amount={amounts[meta.key]}
          income={parsedIncome}
          onChange={(next) => setRow(meta.rowKey, meta.key, next)}
        />
      ))}

      <button
        type="button"
        onClick={() => setShowCats((v) => !v)}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '8px 0', marginTop: 2 }}
      >
        <span style={{ display: 'inline-block', transform: showCats ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }}>▸</span>
        Adjust categories
      </button>

      {showCats && (
        <div style={{ marginBottom: 8 }}>
          {BUCKETS.map((meta) => (
            <div key={meta.key} style={{ marginBottom: 14 }}>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 8 }}>{meta.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(BUDGET_COMMON_CATEGORIES[meta.key] ?? []).map((name) => (
                  <div className="field" key={name}>
                    <label>{name}</label>
                    <KeypadField
                      value={catCaps[meta.key][name] ?? ''}
                      onSave={(raw) => setCatCap(meta.key, name, raw)}
                      placeholder="RM 0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 20 }} />
      <button type="button" onClick={handleSave} className="btn btn-primary btn-lg">Save budget</button>
      <button
        type="button" onClick={onSkip} className="pressable"
        style={{ background: 'none', border: 'none', padding: 10, marginTop: 10, alignSelf: 'center', font: '600 13px var(--font-body)', color: 'var(--color-text-muted)', cursor: 'pointer' }}
      >
        Skip for now
      </button>
    </div>
  );
}
