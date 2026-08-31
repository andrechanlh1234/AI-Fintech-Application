import { describe, it, expect } from 'vitest';
import { reducer } from './reducer';
import { buildInitialState } from './initialState';
import { selectSubscriptions, selectAiContext } from './selectors';
import {
  planRemainingInstallments, planRemainingBalance, planPayoffDate,
  planProgressPct, planMonthlyEquivalent,
} from '../lib/format';
import type { AppState } from './types';

function draft(state: AppState, field: string, value: string | number | boolean): AppState {
  return reducer(state, { type: 'SET_SUB_DRAFT_FIELD', field, value });
}

// A plan: RM 4,200 iPhone over 12 monthly installments, first payment
// 2026-08-01, none paid yet.
function addPlan(state: AppState, over: Partial<Record<string, string | number>> = {}): AppState {
  let s = draft(state, 'kind', 'plan');
  s = draft(s, 'provider', 'Atome');
  s = draft(s, 'name', String(over.name ?? 'iPhone 16'));
  s = draft(s, 'totalAmount', String(over.totalAmount ?? '4200'));
  s = draft(s, 'totalInstallments', Number(over.totalInstallments ?? 12));
  s = draft(s, 'startDate', String(over.startDate ?? '2026-08-01'));
  if (over.paidInstallments != null) s = draft(s, 'paidInstallments', Number(over.paidInstallments));
  return reducer(s, { type: 'ADD_SUBSCRIPTION' });
}

describe('format.ts — installment-plan derivations (flat / 0%, MVP)', () => {
  const plan = { amount: '350', frequency: 'Monthly', startDate: '2026-08-01', totalInstallments: 12, paidInstallments: 4 };

  it('remaining installments = max(0, total − paid)', () => {
    expect(planRemainingInstallments(plan)).toBe(8);
    expect(planRemainingInstallments({ ...plan, paidInstallments: 20 })).toBe(0);
  });

  it('remaining balance = remaining installments × per-installment amount', () => {
    expect(planRemainingBalance(plan)).toBe(8 * 350);
  });

  it('progress = paid / total, clamped', () => {
    expect(planProgressPct(plan)).toBeCloseTo(4 / 12, 5);
    expect(planProgressPct({ ...plan, totalInstallments: 0 })).toBe(0);
  });

  it('monthly-equivalent uses the frequency factor', () => {
    expect(planMonthlyEquivalent(plan)).toBe(350);
    expect(planMonthlyEquivalent({ ...plan, frequency: 'Yearly' })).toBeCloseTo(350 / 12, 5);
  });

  it('payoff date = start + totalInstallments × interval', () => {
    expect(planPayoffDate('2026-08-01', 12, 'Monthly')).toBe('2027-08-01');
    expect(planPayoffDate('', 12, 'Monthly')).toBe('');
    expect(planPayoffDate('2026-08-01', 0, 'Monthly')).toBe('');
  });
});

describe('ADD_SUBSCRIPTION — installment plan path', () => {
  it('auto-fills the per-installment amount from total ÷ count, editable afterward', () => {
    let s = draft(buildInitialState(), 'kind', 'plan');
    s = draft(s, 'totalAmount', '4200');
    s = draft(s, 'totalInstallments', 12);
    expect(s.ob.subDraft.amount).toBe('350.00');

    // a direct edit to amount sticks…
    s = draft(s, 'amount', '360');
    expect(s.ob.subDraft.amount).toBe('360');
    // …until total / count change again
    s = draft(s, 'totalInstallments', 6);
    expect(s.ob.subDraft.amount).toBe('700.00');
  });

  it('stores a plan record in ob.subs discriminated by kind, and resets the draft', () => {
    const s = addPlan(buildInitialState());
    expect(s.ob.subs).toHaveLength(1);
    expect(s.ob.subs[0]).toMatchObject({
      kind: 'plan', name: 'iPhone 16', provider: 'Atome', amount: '350.00',
      totalInstallments: 12, paidInstallments: 0, interestRate: '0', archived: false,
    });
    expect(s.ob.subDraft.kind).toBe('subscription');
    expect(s.ob.subDraft.name).toBe('');
  });

  it('rejects a plan with no tenure', () => {
    let s = draft(buildInitialState(), 'kind', 'plan');
    s = draft(s, 'name', 'Sofa');
    s = draft(s, 'amount', '100');
    s = draft(s, 'totalInstallments', 0);
    s = reducer(s, { type: 'ADD_SUBSCRIPTION' });
    expect(s.ob.subs).toHaveLength(0);
  });

  it('a plan added already fully paid is archived on the way in', () => {
    const s = addPlan(buildInitialState(), { totalInstallments: 3, paidInstallments: 3 });
    expect(s.ob.subs[0].archived).toBe(true);
  });
});

describe('MARK_PLAN_PAYMENT_MADE', () => {
  it('increments paidInstallments and archives on the final payment', () => {
    let s = addPlan(buildInitialState(), { totalInstallments: 3 });
    s = reducer(s, { type: 'MARK_PLAN_PAYMENT_MADE', idx: 0 });
    expect(s.ob.subs[0].paidInstallments).toBe(1);
    expect(s.ob.subs[0].archived).toBe(false);

    s = reducer(s, { type: 'MARK_PLAN_PAYMENT_MADE', idx: 0 });
    s = reducer(s, { type: 'MARK_PLAN_PAYMENT_MADE', idx: 0 });
    expect(s.ob.subs[0].paidInstallments).toBe(3);
    expect(s.ob.subs[0].archived).toBe(true);

    // no-op past completion
    s = reducer(s, { type: 'MARK_PLAN_PAYMENT_MADE', idx: 0 });
    expect(s.ob.subs[0].paidInstallments).toBe(3);
  });
});

describe('selectSubscriptions — active plans feed the monthly total, archived ones drop out', () => {
  it('adds each active plan\'s monthly-equivalent until payoff', () => {
    let s = addPlan(buildInitialState(), { name: 'Phone', totalAmount: '1200', totalInstallments: 12 }); // RM100/mo
    // a plain subscription too
    s = draft(s, 'kind', 'subscription');
    s = draft(s, 'name', 'Netflix');
    s = draft(s, 'amount', '55');
    s = reducer(s, { type: 'ADD_SUBSCRIPTION' });

    let sel = selectSubscriptions(s);
    expect(sel.plansMonthly).toBeCloseTo(100, 5);
    expect(sel.subsMonthly).toBeCloseTo(55, 5);
    expect(sel.monthlyTotal).toBeCloseTo(155, 5);
    expect(sel.plansRemainingBalance).toBeCloseTo(1200, 5);

    // pay it off → it leaves the active total
    for (let i = 0; i < 12; i++) s = reducer(s, { type: 'MARK_PLAN_PAYMENT_MADE', idx: 0 });
    sel = selectSubscriptions(s);
    expect(sel.activePlans).toHaveLength(0);
    expect(sel.plansMonthly).toBe(0);
    expect(sel.monthlyTotal).toBeCloseTo(55, 5);
    expect(sel.plansRemainingBalance).toBe(0);
  });
});

describe('selectAiContext — installmentPlans block', () => {
  it('reports active plan count, monthly total and remaining balance separately from subscriptions', () => {
    let s = addPlan(buildInitialState(), { name: 'Laptop', totalAmount: '3600', totalInstallments: 12 }); // RM300/mo
    s = draft(s, 'kind', 'subscription');
    s = draft(s, 'name', 'Spotify');
    s = draft(s, 'amount', '20');
    s = reducer(s, { type: 'ADD_SUBSCRIPTION' });

    const ctx = selectAiContext(s);
    expect(ctx.installmentPlans).toEqual({ count: 1, monthlyTotalRM: 300, totalRemainingRM: 3600 });
    expect(ctx.subscriptions).toEqual({ count: 1, monthlyTotalRM: 20 });
  });
});
