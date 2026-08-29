import { describe, it, expect } from 'vitest';
import { reducer } from './reducer';
import { buildInitialState } from './initialState';
import type { AppState } from './types';
import type { ReviewItem } from '../lib/seedData';

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

describe('SAVE_RECEIPT — several receipts in one scan session', () => {
  // Regression: "I can't add more than one receipt — after the first, the
  // Save button does nothing." Root causes: SAVE_RECEIPT returned state
  // unchanged (no feedback) whenever a field was missing, SCAN_ANOTHER
  // never reset scanMethod / scanPaymentMethod, and a second SAVE_RECEIPT
  // dispatched from the 'saved' step re-cloned the first receipt.
  function saveQuick(state: AppState, merchant: string, total: string): AppState {
    let s = reducer(state, { type: 'CHOOSE_MANUAL' });
    s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: merchant });
    s = reducer(s, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: total });
    return reducer(s, { type: 'SAVE_RECEIPT' });
  }

  it('a quick receipt and then a detailed receipt both land in state', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });

    state = saveQuick(state, 'Kopitiam', '8.50');
    expect(state.scanStep).toBe('saved');
    expect(state.receipts).toHaveLength(1);
    expect(state.transactions).toHaveLength(1);

    state = reducer(state, { type: 'SCAN_ANOTHER' });
    expect(state.scanStep).toBe('capture');
    expect(state.receiptDraft.merchant).toBe('');
    expect(state.lineItemDrafts).toHaveLength(0);

    state = reducer(state, { type: 'CHOOSE_MANUAL' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'Village Grocer' });
    state = reducer(state, { type: 'SET_RECEIPT_MODE', mode: 'detailed' });
    state = reducer(state, { type: 'ADD_LINE_ITEM_DRAFT' });
    const id = state.lineItemDrafts[0].id;
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'description', value: 'Rice' });
    state = reducer(state, { type: 'SET_LINE_ITEM_DRAFT_FIELD', id, field: 'amount', value: '25.00' });
    state = reducer(state, { type: 'SAVE_RECEIPT' });

    expect(state.scanStep).toBe('saved');
    expect(state.receipts).toHaveLength(2);
    expect(state.transactions).toHaveLength(2);
    // the two receipts are distinct records, not the same one twice
    expect(state.receipts[0].id).not.toBe(state.receipts[1].id);
    expect(state.receipts[1].merchant).toBe('Village Grocer');
  });

  it('a missing field leaves an explanatory scanError instead of silently doing nothing', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = reducer(state, { type: 'CHOOSE_MANUAL' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'No Amount Store' });

    state = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(state.scanStep).toBe('review');
    expect(state.receipts).toHaveLength(0);
    expect(state.scanError).toBeTruthy();

    // fixing the field clears the banner and lets the save through
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '12.00' });
    expect(state.scanError).toBeNull();
    state = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(state.receipts).toHaveLength(1);
  });

  it('a stray SAVE_RECEIPT from the saved step does not clone the receipt', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = saveQuick(state, 'Petronas', '60.00');
    expect(state.receipts).toHaveLength(1);

    const again = reducer(state, { type: 'SAVE_RECEIPT' });
    expect(again.receipts).toHaveLength(1);
    expect(again.transactions).toHaveLength(1);
  });

  it('SCAN_ANOTHER resets the entry method and payment method, not just the draft', () => {
    let state = reducer(buildInitialState(), { type: 'OPEN_SCAN' });
    state = reducer(state, { type: 'CHOOSE_MANUAL' });
    state = reducer(state, { type: 'SET_SCAN_PAYMENT_METHOD', value: 'E-wallet' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'merchant', value: 'A' });
    state = reducer(state, { type: 'SET_RECEIPT_DRAFT_FIELD', field: 'total', value: '5.00' });
    state = reducer(state, { type: 'SAVE_RECEIPT' });

    state = reducer(state, { type: 'SCAN_ANOTHER' });
    expect(state.scanMethod).toBe('manual');
    expect(state.scanPaymentMethod).toBe('Cash');
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

// ---- Statement-import review flow: editable cards + merchant learning ----
function mkReviewItem(partial: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'stmt-1', merchant: 'SHELL KL', name: 'SHELL KL', amount: -45.2, cat: 'Transport',
    dateIso: '2026-08-14', dateLabel: '14 Aug 2026', brand: '', payment: 'Bank statement',
    taxDeductible: false, kind: 'expense', ...partial,
  };
}

describe('REVIEW_DECIDE — builds a transaction from the edited item', () => {
  it('accept uses the item\'s final name / signed amount / date / tax flag', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem()] });
    state = reducer(state, { type: 'UPDATE_REVIEW_ITEM', id: 'stmt-1', patch: { name: 'Petrol — road trip', taxDeductible: true, cat: 'Medical' } });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });

    expect(state.transactions).toHaveLength(1);
    const tx = state.transactions[0];
    expect(tx.merchant).toBe('Petrol — road trip');
    expect(tx.amount).toBe(-45.2);
    expect(tx.cat).toBe('Medical');
    expect(tx.tax).toBe(true);
    expect(tx.reliefKey).toBe('med_self'); // Medical maps to a relief key
    expect(tx.dateLabel).toBe('14 Aug 2026');
  });

  it('reject creates no transaction', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem()] });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'reject' });
    expect(state.transactions).toHaveLength(0);
  });
});

describe('merchant learning layer', () => {
  it('accepting a card upserts merchantMemory keyed by normalised merchant', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem()] });
    state = reducer(state, { type: 'UPDATE_REVIEW_ITEM', id: 'stmt-1', patch: { cat: 'Petrol', payment: 'Maybank' } });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });

    expect(state.merchantMemory['shell kl']).toEqual({
      category: 'Petrol', name: 'SHELL KL', payment: 'Maybank', taxDeductible: false, confirmedCount: 1,
    });
  });

  it('a later import of the same merchant is pre-filled and flagged learned', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem()] });
    state = reducer(state, { type: 'UPDATE_REVIEW_ITEM', id: 'stmt-1', patch: { cat: 'Petrol' } });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });

    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'stmt-2', cat: 'Other' })] });
    const item = state.pendingReviewItems.find((i) => i.id === 'stmt-2')!;
    expect(item.cat).toBe('Petrol');
    expect(item.learned).toBe(true);
    expect(item.autoAdd).toBeUndefined(); // only one prior confirmation
  });

  it('a merchant confirmed >= 2x auto-adds on the next import (never enters the deck)', () => {
    let state = buildInitialState();
    // Confirm SHELL KL twice.
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'a' })] });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'b' })] });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });
    expect(state.merchantMemory['shell kl'].confirmedCount).toBe(2);

    const txBefore = state.transactions.length;
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'c' }), mkReviewItem({ id: 'd', merchant: 'NEW CAFE', name: 'NEW CAFE' })] });

    // 'c' committed immediately; 'd' stays in the deck.
    expect(state.transactions).toHaveLength(txBefore + 1);
    expect(state.autoAddedThisImport).toEqual(['rev-c']);
    expect(state.reviewDecisions['c']).toBe('accept');
    expect(state.reviewDecisions['d']).toBeUndefined();
  });

  it('UNDO_AUTO_ADDED deletes the auto transactions and restores the cards', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'a' })] });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'b' })] });
    state = reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });
    state = reducer(state, { type: 'ADD_PENDING_REVIEW_ITEMS', items: [mkReviewItem({ id: 'c' })] });
    expect(state.autoAddedThisImport).toEqual(['rev-c']);

    state = reducer(state, { type: 'UNDO_AUTO_ADDED' });
    expect(state.autoAddedThisImport).toEqual([]);
    expect(state.transactions.find((t) => t.id === 'rev-c')).toBeUndefined();
    expect(state.reviewDecisions['c']).toBeUndefined();
    const restored = state.pendingReviewItems.find((i) => i.id === 'c')!;
    expect(restored.autoAdd).toBe(false);
    expect(restored.learned).toBe(false);
  });

  it('CLOSE_REVIEW clears autoAddedThisImport', () => {
    let state = buildInitialState();
    state = { ...state, autoAddedThisImport: ['rev-x'], reviewOpen: true };
    state = reducer(state, { type: 'CLOSE_REVIEW' });
    expect(state.autoAddedThisImport).toEqual([]);
  });
});

describe('recurring budget categories (MATERIALIZE_RECURRING)', () => {
  const currentMonName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()];

  it('generates one auto transaction this month for a recurring category, once', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_BUCKET_CATEGORY', bucketKey: 'fixed', name: 'Rent', cap: 1500, openDetail: false });
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    const autos = state.transactions.filter((t) => t.auto);
    expect(autos).toHaveLength(1);
    expect(autos[0].cat).toBe('Rent');
    expect(autos[0].amount).toBe(-1500);
    expect(autos[0].month).toBe(currentMonName);
    // Running it again does nothing.
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    expect(state.transactions.filter((t) => t.auto)).toHaveLength(1);
  });

  it('does not regenerate a month after the auto transaction is deleted', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_BUCKET_CATEGORY', bucketKey: 'fixed', name: 'Utilities', cap: 300, openDetail: false });
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    const autoId = state.transactions.find((t) => t.auto)!.id;
    state = { ...state, transactions: state.transactions.filter((t) => t.id !== autoId) };
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    expect(state.transactions.filter((t) => t.auto)).toHaveLength(0);
  });

  it('a Flexible-bucket category is not recurring by default', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_BUCKET_CATEGORY', bucketKey: 'flexible', name: 'Shopping', cap: 400, openDetail: false });
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    expect(state.transactions.filter((t) => t.auto)).toHaveLength(0);
  });

  it('toggling recurring off stops future generation but keeps existing autos', () => {
    let state = buildInitialState();
    state = reducer(state, { type: 'ADD_BUCKET_CATEGORY', bucketKey: 'fixed', name: 'Loan', cap: 800, openDetail: false });
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    const catId = state.finance.buckets.find((b) => b.key === 'fixed')!.categories[0].id;
    state = reducer(state, { type: 'SET_BUCKET_CATEGORY_RECURRING', bucketKey: 'fixed', catId, on: false });
    expect(state.transactions.filter((t) => t.auto)).toHaveLength(1); // existing kept
    state = { ...state, recurGeneratedMonths: {} }; // pretend a new month
    state = reducer(state, { type: 'MATERIALIZE_RECURRING' });
    expect(state.transactions.filter((t) => t.auto)).toHaveLength(1); // no new one
  });
});
