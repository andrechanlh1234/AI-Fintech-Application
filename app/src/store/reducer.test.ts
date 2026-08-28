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

describe('scan step machine — capture / preview / unable', () => {
  it('PREVIEW_CAPTURED_PHOTO advances capture to preview', () => {
    const state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    expect(state.scanStep).toBe('capture');
    const previewed = reducer(state, { type: 'PREVIEW_CAPTURED_PHOTO' });
    expect(previewed.scanStep).toBe('preview');
  });

  it('RETAKE_PHOTO returns to capture and clears any prior scan error', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = reducer(state, { type: 'CAPTURE_PHOTO_FAILED', message: 'network error' });
    expect(state.scanStep).toBe('unable');
    expect(state.scanError).toBe('network error');

    const retaken = reducer(state, { type: 'RETAKE_PHOTO' });
    expect(retaken.scanStep).toBe('capture');
    expect(retaken.scanError).toBeNull();
  });

  it('CAPTURE_PHOTO_FAILED lands on the unable-to-scan step, not straight into review', () => {
    const state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    const failed = reducer(state, { type: 'CAPTURE_PHOTO_FAILED', message: 'could not read receipt' });
    expect(failed.scanStep).toBe('unable');
    expect(failed.scanError).toBe('could not read receipt');
  });

  it('"Add custom amount" from the unable-to-scan step reuses CHOOSE_MANUAL to land on a blank manual review', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = reducer(state, { type: 'CAPTURE_PHOTO_FAILED', message: 'could not read receipt' });
    const manual = reducer(state, { type: 'CHOOSE_MANUAL' });
    expect(manual.scanStep).toBe('review');
    expect(manual.scanMethod).toBe('manual');
    expect(manual.receiptDraft.merchant).toBe('');
  });
});

describe('SAVE_RECEIPT persists the optional vendor field', () => {
  it('carries ReceiptDraft.vendor onto the saved Receipt', () => {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Team lunch' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'vendor', value: 'Nasi Kandar Pelita' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '42.00' });

    state = reducer(state, { type: 'SAVE_RECEIPT' });

    expect(state.receipts[0].vendor).toBe('Nasi Kandar Pelita');
  });

  it('leaves vendor undefined rather than an empty string when left blank', () => {
    let state = openManualReceipt(buildInitialState());
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'No Vendor Entered' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '10.00' });

    state = reducer(state, { type: 'SAVE_RECEIPT' });

    expect(state.receipts[0].vendor).toBeUndefined();
  });
});

describe('input validation — budget caps and subscription amounts', () => {
  it('ADD_BUCKET_CATEGORY / SET_BUCKET_CATEGORY_CAP clamp a negative or absurd cap to a sane range', () => {
    let state: AppState = {
      ...buildInitialState(),
      finance: { buckets: [{ key: 'flexible', name: 'Flexible', categories: [] }] },
    };

    state = reducer(state, { type: 'ADD_BUCKET_CATEGORY', bucketKey: 'flexible', name: 'Housing', openDetail: false, cap: -9999999999 });
    expect(state.finance.buckets[0].categories[0].cap).toBe(0);

    const catId = state.finance.buckets[0].categories[0].id;
    state = reducer(state, { type: 'SET_BUCKET_CATEGORY_CAP', bucketKey: 'flexible', catId, value: -50 });
    expect(state.finance.buckets[0].categories[0].cap).toBe(0);

    state = reducer(state, { type: 'SET_BUCKET_CATEGORY_CAP', bucketKey: 'flexible', catId, value: 1e15 });
    expect(state.finance.buckets[0].categories[0].cap).toBe(100_000_000);

    state = reducer(state, { type: 'SET_BUCKET_CATEGORY_CAP', bucketKey: 'flexible', catId, value: 800 });
    expect(state.finance.buckets[0].categories[0].cap).toBe(800);
  });

  it('ADD_SUBSCRIPTION rejects a non-positive amount', () => {
    let state = buildInitialState();
    const setDraft = (field: string, value: string) => { state = reducer(state, { type: 'SET_SUB_DRAFT_FIELD', field, value }); };

    setDraft('name', 'TestSub');
    setDraft('amount', '-50');
    state = reducer(state, { type: 'ADD_SUBSCRIPTION' });
    expect(state.ob.subs).toHaveLength(0);

    setDraft('amount', '0');
    state = reducer(state, { type: 'ADD_SUBSCRIPTION' });
    expect(state.ob.subs).toHaveLength(0);

    setDraft('amount', '12.90');
    state = reducer(state, { type: 'ADD_SUBSCRIPTION' });
    expect(state.ob.subs).toHaveLength(1);
    expect(state.ob.subs[0].amount).toBe('12.90');
  });
});
