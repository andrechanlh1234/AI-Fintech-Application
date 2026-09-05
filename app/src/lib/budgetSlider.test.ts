import { describe, expect, it } from 'vitest';
import { BUDGET_SLIDER_MAX, budgetFractionFromValue, budgetValueFromFraction } from './budgetSlider';

describe('budgetValueFromFraction', () => {
  it('maps 0 to RM0 and 1 to the max', () => {
    expect(budgetValueFromFraction(0)).toBe(0);
    expect(budgetValueFromFraction(1)).toBe(BUDGET_SLIDER_MAX);
  });

  it('maps the midpoint to half the max', () => {
    expect(budgetValueFromFraction(0.5)).toBe(BUDGET_SLIDER_MAX / 2);
  });

  it('rounds to the nearest RM10', () => {
    // 0.10007 * 50000 = 5003.5 -> nearest 10 is 5000
    expect(budgetValueFromFraction(0.10007)).toBe(5000);
    // 0.10013 * 50000 = 5006.5 -> nearest 10 is 5010
    expect(budgetValueFromFraction(0.10013)).toBe(5010);
  });

  it('clamps a fraction below 0 to 0', () => {
    expect(budgetValueFromFraction(-0.4)).toBe(0);
  });

  it('clamps a fraction above 1 to the max', () => {
    expect(budgetValueFromFraction(1.4)).toBe(BUDGET_SLIDER_MAX);
  });

  it('honours a custom max', () => {
    expect(budgetValueFromFraction(0.5, 1000)).toBe(500);
  });
});

describe('budgetFractionFromValue', () => {
  it('is the inverse of budgetValueFromFraction at round values', () => {
    expect(budgetFractionFromValue(0)).toBe(0);
    expect(budgetFractionFromValue(BUDGET_SLIDER_MAX)).toBe(1);
    expect(budgetFractionFromValue(BUDGET_SLIDER_MAX / 2)).toBe(0.5);
  });

  it('clamps a negative value to 0', () => {
    expect(budgetFractionFromValue(-500)).toBe(0);
  });

  it('clamps a value above max to 1', () => {
    expect(budgetFractionFromValue(BUDGET_SLIDER_MAX * 2)).toBe(1);
  });

  it('never divides by zero when max is 0', () => {
    expect(budgetFractionFromValue(100, 0)).toBe(0);
  });
});
