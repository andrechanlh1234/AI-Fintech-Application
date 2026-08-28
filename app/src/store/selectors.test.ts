import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reducer } from './reducer';
import { buildInitialState } from './initialState';
import { selectBudgets, selectTaxCenter, selectNetWorth } from './selectors';
import { INCOME_RANGE_OPTS } from '../lib/constants';
import type { AppState } from './types';

function openManualReceipt(state: AppState): AppState {
  let s = reducer(state, { type: 'OPEN_SCAN' });
  s = reducer(s, { type: 'CHOOSE_MANUAL' });
  return s;
}

function quickReceipt(state: AppState, merchant: string, total: string, cat: string, date: string) {
  let s = openManualReceipt(state);
  s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: merchant });
  s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'date', value: date });
  s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: total });
  s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'quickCategory', value: cat });
  return reducer(s, { type: 'SAVE_RECEIPT' });
}

describe('selectBudgets — real transactions move the matching category bar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sums this-month spend into a budget category named after a real transaction category', () => {
    vi.setSystemTime(new Date('2025-06-15T00:00:00Z'));
    let state: AppState = { ...buildInitialState(), mounted: true };
    state = {
      ...state,
      finance: { buckets: [{ key: 'flexible', name: 'Flexible', categories: [{ id: 'c1', name: 'Food & Drink', cap: 500, items: [] }] }] },
    };

    state = quickReceipt(state, 'Nasi Lemak Wanjo', '25.00', 'Food & Drink', '2025-06-10');
    state = quickReceipt(state, 'Starbucks KLCC', '18.50', 'Food & Drink', '2025-06-12');
    // a different month must not count
    state = quickReceipt(state, 'Old Town', '9.00', 'Food & Drink', '2025-05-30');
    // a different category must not count toward Food & Drink
    state = quickReceipt(state, 'Grab', '15.00', 'Transport', '2025-06-11');

    const { buckets } = selectBudgets(state);
    const cat = buckets[0].categories[0];
    expect(cat.spent).toBeCloseTo(43.5, 5); // 25.00 + 18.50 only
    expect(cat.total).toBe(500);
    expect(cat.pct).toBe(9); // round(43.5/500*100)
  });
});

// The "Individual & Dependent Relatives" relief (RM9,000) is `automatic:
// true` -- always fully captured, independent of any transaction -- so
// totalCaptured has a fixed RM9,000 floor even with zero receipts. These
// tests check the specific relief item a receipt should (or shouldn't)
// move, rather than the grand total, so that floor doesn't mask the thing
// actually under test.
function medicalReliefCaptured(taxCenter: ReturnType<typeof selectTaxCenter>): number {
  const group = taxCenter.groups.flatMap((g) => g.items).find((it) => it.key === 'med_self');
  return group?.captured ?? 0;
}

describe('selectTaxCenter — only deductible detailed-mode line items count toward relief', () => {
  it('a quick-mode receipt in a relief-mapped category is captured by default (auto-suggested deductible)', () => {
    let state = buildInitialState();
    state = quickReceipt(state, 'Guardian Pharmacy', '65.00', 'Health', '2025-03-01');
    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });
    expect(medicalReliefCaptured(tax)).toBe(65);
  });

  it('a quick-mode receipt in a category with no relief mapping is not captured by default', () => {
    let state = buildInitialState();
    state = quickReceipt(state, 'Jaya Grocer', '65.00', 'Groceries', '2025-03-01');
    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });
    expect(medicalReliefCaptured(tax)).toBe(0);
  });

  it('the user can override the auto-suggested deductibility back off', () => {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Guardian Pharmacy' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'date', value: '2025-03-01' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '65.00' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'quickCategory', value: 'Health' });
    expect(state.receiptDraft.tax).toBe(true); // auto-suggested on
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'tax', value: false }); // user turns it off
    state = reducer(state, { type: 'SAVE_RECEIPT' });

    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });
    expect(medicalReliefCaptured(tax)).toBe(0);
  });

  it('a detailed-mode deductible line item is captured under a relief group', () => {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Fitness First Gym' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'date', value: '2025-06-05' });
    state = reducer(state, { type: 'SET_RECEIPT_MODE', mode: 'detailed' });
    state = reducer(state, { type: 'ADD_LINE_ITEM_DRAFT' });
    const id = state.lineItemDrafts[0].id;
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'description', value: 'Annual membership' });
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'amount', value: '600.00' });
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'cat', value: 'Health' });
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'deductible', value: true });
    state = reducer(state, { type: 'SAVE_RECEIPT' });

    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });
    expect(medicalReliefCaptured(tax)).toBe(600);
  });
});

describe('selectTaxCenter — relief aggregation clamps to caps', () => {
  const medicalGroupCaptured = (tax: ReturnType<typeof selectTaxCenter>): number =>
    tax.groups.find((g) => g.key === 'medical')?.captured ?? 0;

  it('does not subtract the RM 9,000 automatic relief twice from chargeable income (M1)', () => {
    const incomeLabel = INCOME_RANGE_OPTS.find((l) => l.startsWith('RM 8,300'))!;
    let state = buildInitialState();
    state = { ...state, ob: { ...state.ob, income: incomeLabel, approxIncome: '' } };

    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });

    expect(tax.grossAnnualIncome).toBeGreaterThan(0); // label resolved to a real figure
    expect(tax.totalCaptured).toBe(9000); // only the automatic indiv_self relief, no receipts
    expect(tax.chargeableIncomeEst).toBe(tax.grossAnnualIncome - 9000);
    // regression guard: the old formula did gross - 9000 - totalCaptured
    expect(tax.chargeableIncomeEst).not.toBe(tax.grossAnnualIncome - 18000);
  });

  it('over-cap tagging inflates only the per-item badge, not the group or grand total (M2)', () => {
    let state = buildInitialState();
    // med_self cap is RM 10,000; tag RM 13,500 of medical receipts toward it.
    state = quickReceipt(state, 'Hospital A', '4500.00', 'Health', '2025-02-01');
    state = quickReceipt(state, 'Hospital B', '4500.00', 'Health', '2025-03-01');
    state = quickReceipt(state, 'Hospital C', '4500.00', 'Health', '2025-04-01');

    const tax = selectTaxCenter({ ...state, taxYear: 'YA2025' });

    expect(medicalReliefCaptured(tax)).toBe(13500); // per-item stays raw (can show >100%)
    expect(medicalGroupCaptured(tax)).toBe(10000); // group clamps each item to its cap
    expect(tax.totalCaptured).toBeLessThanOrEqual(tax.totalCap);
    expect(tax.taxOptPct).toBeLessThanOrEqual(100);
  });
});

describe('selectNetWorth is never affected by receipts/transactions', () => {
  // This is the single most important invariant of the receipt/transaction
  // feature: the spec explicitly requires Net Worth to stay untouched by
  // scanned or manually-entered receipts. selectNetWorth only reads
  // state.netWorthSeed and state.ob.manual -- never state.transactions or
  // state.receipts -- and this test pins that down so a future change
  // can't accidentally wire them together.
  it('adding, editing, and deleting receipts leaves net worth exactly where it started', () => {
    let state = buildInitialState();
    const before = selectNetWorth(state);

    state = quickReceipt(state, 'IKEA Cheras', '899.00', 'Shopping', '2025-04-10');
    const txId = state.transactions[0].id;
    let after = selectNetWorth(state);
    expect(after.netWorth).toBe(before.netWorth);
    expect(after.assets).toBe(before.assets);
    expect(after.liabilities).toBe(before.liabilities);

    state = reducer(state, { type: 'OPEN_TX_DETAIL', id: txId });
    state = reducer(state, { type: 'SET_TX_DRAFT_FIELD', field: 'amount', value: '5000.00' });
    state = reducer(state, { type: 'SAVE_TX_DETAIL' });
    after = selectNetWorth(state);
    expect(after.netWorth).toBe(before.netWorth);

    state = reducer(state, { type: 'CLEAR_ALL_DATA' });
    after = selectNetWorth(state);
    expect(after.netWorth).toBe(before.netWorth);
  });
});
