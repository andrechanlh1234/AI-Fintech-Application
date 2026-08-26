import { uid } from './ids';

/** One receipt -- the parent/source record a scan or manual entry
 * produces. The financial transactions it generates (one per line item in
 * Detailed Mode, or exactly one in Quick Mode) live in state.transactions
 * with a matching receiptId; this record itself never changes after save,
 * so it stays a source-of-truth summary even after its transactions are
 * individually edited or deleted. */
export interface Receipt {
  id: string;
  merchant: string;
  /** Optional business/vendor name, distinct from `merchant` (which is the
   * user-facing expense label shown everywhere else — transaction rows,
   * this receipt's own summary). Captured for the record only; nothing
   * else in the app reads it yet. */
  vendor?: string;
  dateLabel: string;
  total: number;
  lineItemsTotal: number;
  source: 'scan' | 'manual';
}

/** One row in the line-item review/edit list -- shared by the OCR review
 * screen and manual Detailed Mode (see ReceiptLineItemsEditor), so both
 * entry paths produce the exact same Transaction shape on save.
 * `touched` flips true on the row's first edit; an OCR-sourced row with
 * low `confidence` is flagged "needs review" only while untouched -- see
 * lineItemNeedsReview() below. Manually-added rows start `touched: true`
 * (nothing to review -- the user just typed it) and `confidence: 1`. */
export interface ReceiptLineItemDraft {
  id: string;
  description: string;
  amount: string;
  cat: string;
  deductible: boolean;
  confidence: number;
  touched: boolean;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function lineItemNeedsReview(item: ReceiptLineItemDraft): boolean {
  return !item.touched && item.confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function lineItemIsInvalid(item: ReceiptLineItemDraft): boolean {
  return !item.description.trim() || !(parseFloat(item.amount) > 0);
}

export function mkLineItemDraft(partial?: Partial<ReceiptLineItemDraft>): ReceiptLineItemDraft {
  return {
    id: uid(), description: '', amount: '', cat: 'Food & Drink', deductible: false,
    confidence: 1, touched: true, ...partial,
  };
}

export interface ReceiptDraft {
  /** The expense's user-facing label ("Expense name" in the UI) -- drives
   * every downstream display (transaction rows, the Saved screen, etc.),
   * same role this field has always played under its old "Merchant" label. */
  merchant: string;
  /** Optional business/vendor name ("Vendor/Merchant" in the UI) -- new,
   * separate metadata alongside `merchant`. See Receipt.vendor. */
  vendor: string;
  /** ISO (YYYY-MM-DD) -- what <input type="date"> reads/writes, same
   * convention as TxDraft.date. Converted to a display label only at save
   * time (isoToDisplayDate), same as SAVE_TX_DETAIL already does. */
  date: string;
  total: string;
  quickCategory: string;
  tag: string;
  mode: 'quick' | 'detailed';
  /** Quick-mode only ("Add line items" mode has its own per-item toggle,
   * ReceiptLineItemsEditor's `deductible`). Auto-suggested from
   * `quickCategory` via `categoryToReliefKey` whenever the category
   * changes (see reducer's SET_RECEIPT_DRAFT_FIELD case) but stays a
   * plain user-editable boolean -- the whole point of showing it is to
   * let the user override the suggestion, e.g. a Shopping receipt that
   * wasn't actually a deductible purchase. */
  tax: boolean;
}

export function blankReceiptDraft(dateIso: string): ReceiptDraft {
  return {
    merchant: '', vendor: '', date: dateIso, total: '', quickCategory: 'Food & Drink',
    tag: '', mode: 'quick', tax: false,
  };
}
