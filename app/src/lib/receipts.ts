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
  dateLabel: string;
  total: number;
  lineItemsTotal: number;
  taxAmount?: number;
  taxRate?: number;
  serviceChargeAmount?: number;
  serviceChargeRate?: number;
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
  merchant: string;
  /** ISO (YYYY-MM-DD) -- what <input type="date"> reads/writes, same
   * convention as TxDraft.date. Converted to a display label only at save
   * time (isoToDisplayDate), same as SAVE_TX_DETAIL already does. */
  date: string;
  total: string;
  quickCategory: string;
  taxAmount: string;
  taxRate: string;
  serviceChargeAmount: string;
  serviceChargeRate: string;
  tag: string;
  mode: 'quick' | 'detailed';
}

export function blankReceiptDraft(dateIso: string): ReceiptDraft {
  return {
    merchant: '', date: dateIso, total: '', quickCategory: 'Food & Drink',
    taxAmount: '', taxRate: '6', serviceChargeAmount: '', serviceChargeRate: '',
    tag: '', mode: 'quick',
  };
}
