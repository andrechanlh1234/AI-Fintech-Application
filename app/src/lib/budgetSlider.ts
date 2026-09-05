// Pure math for BudgetBucketRow's drag-to-set slider (onboarding "Set your
// monthly budget" step, and anywhere else a budget bucket amount is set).
// Kept separate from the component so the position<->value mapping is
// unit-testable without a DOM/pointer-event harness (this repo has no
// component-render test setup — see vitest.config.ts's `environment: 'node'`
// and every other *.test.ts here covering pure logic only).

export const BUDGET_SLIDER_MAX = 50_000;

/** Nearest-RM10 rounding -- steady increments while dragging, matching the
 * RM10 rounding the auto-split template (BudgetSetupStep's computeTemplate)
 * already uses elsewhere in this same flow. */
function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/** A horizontal drag position, expressed as the fraction of the track's
 * width the pointer sits at (0 = left edge, 1 = right edge, already clamped
 * by the caller against the track's own bounding rect), to a budget amount
 * in RM. Rounds to the nearest RM10 and clamps to [0, max]. */
export function budgetValueFromFraction(fraction: number, max: number = BUDGET_SLIDER_MAX): number {
  const clampedFraction = Math.max(0, Math.min(1, fraction));
  return Math.max(0, Math.min(max, round10(clampedFraction * max)));
}

/** Inverse of budgetValueFromFraction -- where the thumb should sit for a
 * given amount, as a 0-1 fraction of the track width. */
export function budgetFractionFromValue(value: number, max: number = BUDGET_SLIDER_MAX): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}
