import { describe, it, expect } from 'vitest';
import { reducer } from './reducer';
import { buildInitialState } from './initialState';
import type { AppState } from './types';

// These tests exist because this app has no server-side database of
// record -- state.transactions/state.receipts (and everything derived
// from them: budgets, stats, tax) is the single source of truth. A silent
// bug here is a wrong dollar amount shown to a real user, not just a
// crash, so the money-shaped actions (receipt save, edit, delete, clear)
// get direct reducer-level coverage instead of relying on manual QA.

function openManualReceipt(state: AppState): AppState {
  let s = reducer(state, { type: 'OPEN_SCAN' });
  s = reducer(s, { type: 'CHOOSE_MANUAL' });
  return s;
}

describe('SAVE_RECEIPT — quick mode', () => {
  it('creates exactly one expense transaction linked to the new receipt', () => {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Starbucks KLCC' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'date', value: '2025-01-15' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '18.50' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'quickCategory', value: 'Food & Drink' });

    state = reducer(state, { type: 'SAVE_RECEIPT' });

    expect(state.receipts).toHaveLength(1);
    expect(state.transactions).toHaveLength(1);
    const tx = state.transactions[0];
    expect(tx.merchant).toBe('Starbucks KLCC');
    expect(tx.cat).toBe('Food & Drink');
    expect(tx.amount).toBe(-18.5); // expenses are always negative
    expect(tx.tax).toBe(false); // quick mode is never tax-deductible
    expect(tx.receiptId).toBe(state.receipts[0].id);
  });

  it('refuses to save with no merchant or a zero/blank total', () => {
    let state = openManualReceipt(buildInitialState());
    // no merchant at all
    let attempt = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(attempt.transactions).toHaveLength(0);

    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Empty Total Store' });
    attempt = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(attempt.transactions).toHaveLength(0);
    expect(attempt.receipts).toHaveLength(0);
  });
});

describe('SAVE_RECEIPT — detailed mode', () => {
  function detailedReceipt(items: { desc: string; amount: string; cat: string; deductible: boolean }[]) {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Village Grocer' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'date', value: '2025-05-12' });
    state = reducer(state, { type: 'SET_RECEIPT_MODE', mode: 'detailed' });
    // fresh detailed mode with nothing typed yet seeds zero items -- add one per item
    for (let i = 0; i < items.length; i++) state = reducer(state, { type: 'ADD_LINE_ITEM_DRAFT' });
    items.forEach((it, i) => {
      const id = state.lineItemDrafts[i].id;
      state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'description', value: it.desc });
      state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'amount', value: it.amount });
      state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'cat', value: it.cat });
      if (it.deductible) state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'deductible', value: true });
    });
    return state;
  }

  it('splits one receipt into one transaction per line item, each independently tagged', () => {
    let state = detailedReceipt([
      { desc: 'Groceries', amount: '45.20', cat: 'Food & Drink', deductible: false },
      { desc: 'Vitamins', amount: '38.00', cat: 'Health', deductible: true },
    ]);
    state = reducer(state, { type: 'SAVE_RECEIPT' });

    expect(state.receipts).toHaveLength(1);
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.every((t) => t.receiptId === state.receipts[0].id)).toBe(true);

    const groceries = state.transactions.find((t) => t.merchant === 'Groceries')!;
    expect(groceries.amount).toBe(-45.2);
    expect(groceries.tax).toBe(false);
    expect(groceries.reliefKey).toBeUndefined();

    const vitamins = state.transactions.find((t) => t.merchant === 'Vitamins')!;
    expect(vitamins.amount).toBe(-38);
    expect(vitamins.tax).toBe(true);
    expect(vitamins.reliefKey).toBeDefined(); // deductible items get a relief bucket, non-deductible ones don't
  });

  it('refuses to save while any line item is invalid (blank description or non-positive amount)', () => {
    let state = detailedReceipt([{ desc: '', amount: '10.00', cat: 'Other', deductible: false }]);
    state = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(state.transactions).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);
  });

  it('an adjustment line item added to close a total/line-item mismatch is itself a normal, savable line', () => {
    let state = detailedReceipt([{ desc: 'Furniture', amount: '100.00', cat: 'Shopping', deductible: false }]);
    state = reducer(state, { type: 'ADD_ADJUSTMENT_LINE_ITEM', amount: 12.34 });
    expect(state.lineItemDrafts).toHaveLength(2);
    state = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(state.transactions).toHaveLength(2);
    const adjustment = state.transactions.find((t) => t.merchant === 'Discount / adjustment')!;
    expect(adjustment.amount).toBe(-12.34);
  });
});

describe('editing and deleting a receipt-derived transaction', () => {
  function savedQuickReceipt(amount: string, cat: string) {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'IKEA Cheras' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: amount });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'quickCategory', value: cat });
    return reducer(state, { type: 'SAVE_RECEIPT' });
  }

  it('SAVE_TX_DETAIL updates the transaction amount/category in place, receipt record untouched', () => {
    let state = savedQuickReceipt('210.00', 'Shopping');
    const txId = state.transactions[0].id;
    const receiptCountBefore = state.receipts.length;

    state = reducer(state, { type: 'OPEN_TX_DETAIL', id: txId });
    state = reducer(state, { type: 'SET_TX_DRAFT_FIELD', field: 'amount', value: '250.00' });
    state = reducer(state, { type: 'SET_TX_DRAFT_FIELD', field: 'cat', value: 'Lifestyle' });
    state = reducer(state, { type: 'SAVE_TX_DETAIL' });

    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(-250);
    expect(state.transactions[0].cat).toBe('Lifestyle');
    expect(state.receipts).toHaveLength(receiptCountBefore); // the parent receipt record never changes after save
  });

  it('DELETE_TX_DETAIL removes the transaction but leaves the receipt record alone (by design)', () => {
    let state = savedQuickReceipt('50.00', 'Other');
    const txId = state.transactions[0].id;

    state = reducer(state, { type: 'OPEN_TX_DETAIL', id: txId });
    state = reducer(state, { type: 'DELETE_TX_DETAIL' });

    expect(state.transactions).toHaveLength(0);
    // the receipt is now orphaned -- CLEAR_ALL_DATA/LOAD_TRIAL_DATA must not
    // leave orphans like this lying around forever, see the suite below.
    expect(state.receipts).toHaveLength(1);
  });
});

describe('APPLY_TAX_PRESET / APPLY_SERVICE_PRESET — recommend, never silently overwrite', () => {
  function draftWithTotal(total: string) {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Village Grocer' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: total });
    return state;
  }

  it('backs the tax amount out of a tax-inclusive total, not a flat percentage of it', () => {
    let state = draftWithTotal('106.00');
    state = reducer(state, { type: 'APPLY_TAX_PRESET', rate: 6 });
    // 106 already includes 6% SST -> the SST portion is 106 * 6/106 = 6.00,
    // not 106 * 0.06 = 6.36 (which would double-count the tax already baked in).
    expect(state.receiptDraft.taxAmount).toBe('6.00');
    expect(state.receiptDraft.taxRate).toBe('6');
    expect(state.receiptDraft.taxSuggestionNote).toBe('Estimated from 6% SST');
  });

  it('leaves the amount blank with no note when there is no total yet to estimate from', () => {
    let state = draftWithTotal('');
    state = reducer(state, { type: 'APPLY_TAX_PRESET', rate: 6 });
    expect(state.receiptDraft.taxAmount).toBe('');
    expect(state.receiptDraft.taxSuggestionNote).toBeUndefined();
  });

  it('service preset works the same way, independently of the tax preset', () => {
    let state = draftWithTotal('110.00');
    state = reducer(state, { type: 'APPLY_SERVICE_PRESET', rate: 10 });
    expect(state.receiptDraft.serviceChargeAmount).toBe('10.00'); // 110 * 10/110
    expect(state.receiptDraft.serviceSuggestionNote).toBe('Estimated from 10% service charge');
    expect(state.receiptDraft.taxSuggestionNote).toBeUndefined(); // untouched
  });

  it('typing directly into the amount field retires the suggestion note (it is now the user\'s own figure)', () => {
    let state = draftWithTotal('106.00');
    state = reducer(state, { type: 'APPLY_TAX_PRESET', rate: 6 });
    expect(state.receiptDraft.taxSuggestionNote).toBe('Estimated from 6% SST');

    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'taxAmount', value: '7.50' });
    expect(state.receiptDraft.taxAmount).toBe('7.50');
    expect(state.receiptDraft.taxSuggestionNote).toBeUndefined();
    // the rate chip itself stays a record of the baseline the user started
    // from, even though the exact figure is now theirs
    expect(state.receiptDraft.taxRate).toBe('6');
  });

  it('CAPTURE_PHOTO_RESULT labels an OCR-detected tax line as detected, not estimated', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = reducer(state, {
      type: 'CAPTURE_PHOTO_RESULT',
      result: {
        vendor: 'Village Grocer', date: '2026-08-20', total: 106, confidence: 0.9,
        taxAmount: 6, taxRate: 6, serviceChargeAmount: null, serviceChargeRate: null,
        lineItems: [],
      },
    });
    expect(state.receiptDraft.taxAmount).toBe('6.00');
    expect(state.receiptDraft.taxSuggestionNote).toBe('Detected from your receipt');
    expect(state.receiptDraft.serviceSuggestionNote).toBeUndefined();
  });
});

describe('CLEAR_ALL_DATA / LOAD_TRIAL_DATA reset receipts along with transactions', () => {
  // Regression test: these two actions used to reset state.transactions but
  // never state.receipts, so a receipt whose transaction(s) had already
  // been cleared/deleted would survive forever as an orphaned record with
  // no transaction pointing back at it (found by populating a large trial
  // dataset through the live UI and then clearing it).
  function stateWithOneReceipt(): AppState {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Leftover Test Mart' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '20.00' });
    return reducer(state, { type: 'SAVE_RECEIPT' });
  }

  it('CLEAR_ALL_DATA empties both transactions and receipts', () => {
    const state = reducer(stateWithOneReceipt(), { type: 'CLEAR_ALL_DATA' });
    expect(state.transactions).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);
  });

  it('LOAD_TRIAL_DATA replaces receipts too, not just transactions', () => {
    const state = reducer(stateWithOneReceipt(), { type: 'LOAD_TRIAL_DATA' });
    // trial data ships no receipts of its own (Quick/Detailed mode receipts
    // only come from user entry), so this must be empty, not carrying the
    // pre-existing "Leftover Test Mart" receipt forward.
    expect(state.receipts).toHaveLength(0);
  });
});
