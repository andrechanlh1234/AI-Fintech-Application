// Reducer ported from Cukai v7.dc.html's action methods (lines 2069-2343).
// Each Action variant corresponds 1:1 to an original `this.xyz = (...) => this.setState(...)` method,
// so screen components can call `actions.xyz(...)` exactly as the original template called `{{xyz}}`.
import type { AppState, ManualData, BalanceDraft, TxDraft, Subscription } from './types';
import { mkCategory, mkItem, defaultNetWorthSeed, type ReviewItem, type Transaction } from '../lib/seedData';
import { upsertMerchantMemory, lookupMerchantMemory } from '../lib/merchantMemory';
import {
  blankReceiptDraft, mkLineItemDraft, lineItemIsInvalid, lineItemNeedsReview,
  type Receipt, type ReceiptDraft,
} from '../lib/receipts';
import { uid } from '../lib/ids';
import { clamp, isoToDisplayDate, displayDateToIso, computeNextPayment, todayIso, todayDisplayDate, dateGroupFor, parseDisplayDate } from '../lib/format';
import { categoryToReliefKey } from '../lib/taxEngine';
import { mapOcrCategory, CAT_ICON, GOAL_FOLLOWUP } from '../lib/constants';
import { materializeRecurring } from '../lib/recurring';
import { buildTrialData, emptyTrialData } from '../lib/trialData';
import { applySyncPayload, type SyncPayload } from './initialState';
import type { AuthUser, ScannedReceiptResult } from '../lib/api';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The month a scan/manual transaction actually happened in, derived from its
// real entered date label ("3 Jul 2026") — falls back to the real current
// month only if the label doesn't parse, never to a fixed placeholder month.
function monthFromDateLabel(label: string): string {
  return parseDisplayDate(label)?.month ?? SHORT_MONTHS[new Date().getMonth()];
}

// A budget cap comes straight from a free-text amount field. Clamp it to a
// sane non-negative range so a stray "-" or a pasted huge number can't
// poison every dependent total (Home budget line, Budgets gauge scale).
const MAX_BUDGET_CAP = 100_000_000;
function clampCap(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, MAX_BUDGET_CAP);
}

// A couple of primary money goals imply a MONTHLY savings figure once their
// follow-up is filled in (see GOAL_FOLLOWUP.monthlySavings) — mirror it into
// ob.savingsTarget so the budget step keeps reading one string. Goals with no
// monthly implication (emergency fund) leave it blank.
function deriveObSavingsTarget(primaryGoal: string | null, detail: Record<string, string>): string {
  const cfg = primaryGoal ? GOAL_FOLLOWUP[primaryGoal] : undefined;
  return cfg?.monthlySavings ? cfg.monthlySavings(detail) : '';
}

/** The slice of scan-flow state that must be wiped whenever the receipt
 * flow starts fresh — opening it (OPEN_SCAN), leaving it (CLOSE_SCAN) or
 * "Scan another" (SCAN_ANOTHER). Previously each of these reset a different
 * subset: SCAN_ANOTHER never cleared `scanMethod` / `scanPaymentMethod`, and
 * CLOSE_SCAN cleared nothing at all, so the just-saved receipt's draft, line
 * items, entry method and any error banner leaked into the next receipt —
 * and a stray SAVE_RECEIPT before the new draft was filled re-saved the
 * previous one. One helper, applied everywhere the flow (re)starts. */
function freshScanFields(): Pick<
  AppState,
  'scanStep' | 'scanError' | 'scanMethod' | 'scanPaymentMethod' | 'receiptDraft' | 'lineItemDrafts'
> {
  return {
    scanStep: 'capture',
    scanError: null,
    scanMethod: 'manual',
    scanPaymentMethod: 'Cash',
    receiptDraft: blankReceiptDraft(todayIso()),
    lineItemDrafts: [],
  };
}

type ManualListKey = keyof ManualData;

export type Action =
  | { type: 'SET_OB_FIELD'; field: string; value: unknown }
  | { type: 'SET_OB_OTHER'; field: string; value: string }
  | { type: 'TOGGLE_OB_ARRAY'; field: 'incomeTypes' | 'reliefs' | 'goals'; value: string }
  | { type: 'SET_OB_GOAL_DETAIL'; key: string | null; value?: string }
  | { type: 'OB_NEXT'; nextStep: string }
  | { type: 'OB_BACK'; prevStep: string }
  | { type: 'OB_FINISH' }
  | { type: 'TOGGLE_AGREED_TERMS' }
  | { type: 'CHOOSE_SETUP_METHOD'; method: 'link' | 'manual'; nextStep: string }
  | { type: 'TOGGLE_LINK_TARGET_START'; id: string }
  | { type: 'TOGGLE_LINK_TARGET_COMPLETE'; id: string }
  | { type: 'TOGGLE_LINK_TARGET_REMOVE'; id: string }
  | { type: 'RESET_ONBOARDING' }
  | { type: 'LOAD_TRIAL_DATA' }
  | { type: 'CLEAR_ALL_DATA' }

  | { type: 'GO_TAB'; tab: AppState['tab'] }
  | { type: 'OPEN_MORE_PANEL' } | { type: 'CLOSE_MORE_PANEL' }
  | { type: 'OPEN_NOTIF_PANEL' } | { type: 'CLOSE_NOTIF_PANEL' }
  | { type: 'GO_FINANCE_SECTION'; section: AppState['financeSection'] }

  | { type: 'SET_NETWORTH_RANGE'; range: AppState['netWorthRange'] }
  | { type: 'SELECT_NW_POINT'; idx: number | null }

  | { type: 'SET_HISTORY_MONTH'; month: string }
  | { type: 'SET_HISTORY_YEAR'; year: number }
  | { type: 'SET_RECORD_RANGE'; from: string; to: string }
  | { type: 'SET_TX_SEARCH'; value: string }
  | { type: 'SET_TX_FILTER'; value: string }

  | { type: 'SET_STATS_PERIOD'; value: string }
  | { type: 'OPEN_STATS_CATEGORY_DETAIL'; cat: string }
  | { type: 'CLOSE_STATS_CATEGORY_DETAIL' }

  | { type: 'OPEN_TAX_PROFILE' } | { type: 'CLOSE_TAX_PROFILE' }
  | { type: 'OPEN_DONATE' } | { type: 'CLOSE_DONATE' }
  | { type: 'SET_DONATE_AMOUNT'; value: string } | { type: 'SUBMIT_DONATE' }

  | { type: 'SET_SCAN_PAYMENT_METHOD'; value: string }

  | { type: 'TOGGLE_BUCKET'; key: string }
  | { type: 'ADD_BUCKET_CATEGORY'; bucketKey: string; name?: string; openDetail?: boolean; cap?: number }
  | { type: 'REMOVE_BUCKET_CATEGORY'; bucketKey: string; catId: string }
  | { type: 'SET_BUCKET_CATEGORY_NAME'; bucketKey: string; catId: string; value: string }
  | { type: 'SET_BUCKET_CATEGORY_CAP'; bucketKey: string; catId: string; value: number }
  | { type: 'SET_BUCKET_CATEGORY_RECURRING'; bucketKey: string; catId: string; on: boolean }
  | { type: 'SET_BUCKET_CATEGORY_RECUR_DAY'; bucketKey: string; catId: string; day: number }
  | { type: 'MATERIALIZE_RECURRING' }
  | { type: 'ADD_BUCKET_ITEM'; bucketKey: string; catId: string }
  | { type: 'SET_BUCKET_ITEM_FIELD'; bucketKey: string; catId: string; itemId: string; field: 'name' | 'amount'; value: string | number }
  | { type: 'REMOVE_BUCKET_ITEM'; bucketKey: string; catId: string; itemId: string }
  | { type: 'OPEN_BUDGET_ITEM_DETAIL'; key: string } | { type: 'CLOSE_BUDGET_ITEM_DETAIL' }
  | { type: 'TOGGLE_DONUT_EXPANDED' }

  | { type: 'SET_TAX_YEAR'; year: string }
  | { type: 'TOGGLE_TAX_GROUP'; key: string }
  | { type: 'OPEN_TAX_ITEM_DETAIL'; key: string } | { type: 'CLOSE_TAX_ITEM_DETAIL' }
  | { type: 'OPEN_TAX_RECEIPTS' } | { type: 'CLOSE_TAX_RECEIPTS' }
  | { type: 'OPEN_TAX_PACK' } | { type: 'CLOSE_TAX_PACK' } | { type: 'UPGRADE_FROM_TAX_PACK' }
  | { type: 'TOGGLE_SUBSCRIPTION_TIER' }

  | { type: 'SET_FACE_ID'; on: boolean } | { type: 'TOGGLE_FACE_ID' }
  | { type: 'TOGGLE_SETTING'; key: 'budgetAlerts' | 'taxReminders' | 'weeklySummary' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }

  | { type: 'ADD_RECORD'; listKey: Exclude<ManualListKey, 'investments'> }
  | { type: 'SET_RECORD_FIELD'; listKey: Exclude<ManualListKey, 'investments'>; id: string; field: 'name' | 'amount' | 'date'; value: string }
  | { type: 'REMOVE_RECORD'; listKey: Exclude<ManualListKey, 'investments'>; id: string }
  | { type: 'SET_INVEST_FIELD'; idx: number; field: 'name' | 'qty' | 'buy' | 'cur'; value: string }
  | { type: 'ADD_INVESTMENT_ROW' }
  | { type: 'REMOVE_INVESTMENT_ROW'; idx: number }

  | { type: 'SET_SUB_DRAFT_FIELD'; field: string; value: string | number | boolean }
  | { type: 'ADD_SUBSCRIPTION' }
  | { type: 'REMOVE_SUBSCRIPTION'; idx: number }
  | { type: 'MARK_PLAN_PAYMENT_MADE'; idx: number }
  | { type: 'OPEN_ADD_SUB' } | { type: 'CLOSE_ADD_SUB' }

  | { type: 'OPEN_BALANCE_DETAIL'; listKey: string; id: string } | { type: 'CLOSE_BALANCE_DETAIL' }
  | { type: 'SET_BALANCE_DRAFT_FIELD'; field: keyof BalanceDraft; value: string }
  | { type: 'SUBMIT_BALANCE_ENTRY'; listKey: string; id: string }
  | { type: 'REMOVE_BALANCE_ENTRY'; listKey: string; id: string; entryId: string }
  | { type: 'OPEN_TX_DETAIL'; id: string | number } | { type: 'CLOSE_TX_DETAIL' }
  | { type: 'SET_TX_DRAFT_FIELD'; field: keyof TxDraft; value: string | boolean }
  | { type: 'SAVE_TX_DETAIL' } | { type: 'DELETE_TX_DETAIL' }
  | { type: 'OPEN_HISTORY'; listKey: string; id: string } | { type: 'CLOSE_HISTORY' }

  | { type: 'TOGGLE_NW_GROUP'; key: string }
  | { type: 'OPEN_INVEST_DETAIL'; listKey: string; id: string } | { type: 'CLOSE_INVEST_DETAIL' }
  | { type: 'SET_INVEST_DETAIL_FIELD'; listKey: string; id: string; field: string; value: string }

  | { type: 'SWIPE_CONFIRM'; id: string | number }

  | { type: 'OPEN_REVIEW' } | { type: 'CLOSE_REVIEW' }
  | { type: 'REVIEW_DECIDE'; dir: 'accept' | 'reject' }
  | { type: 'REVIEW_DOWN'; clientX: number }
  | { type: 'REVIEW_MOVE'; clientX: number }
  | { type: 'REVIEW_UP' }
  | { type: 'ADD_PENDING_REVIEW_ITEMS'; items: ReviewItem[] }
  | { type: 'UPDATE_REVIEW_ITEM'; id: string; patch: Partial<ReviewItem> }
  | { type: 'UNDO_AUTO_ADDED' }
  | { type: 'SET_STATEMENT_UPLOADING'; value: boolean }
  | { type: 'SET_STATEMENT_UPLOAD_ERROR'; message: string | null }
  | { type: 'CONFIRM_BUDGET_PROMPT'; cap: number }
  | { type: 'DISMISS_BUDGET_PROMPT' }

  | { type: 'OPEN_SCAN' } | { type: 'CLOSE_SCAN' }
  | { type: 'CHOOSE_MANUAL' }
  | { type: 'PREVIEW_CAPTURED_PHOTO' }
  | { type: 'RETAKE_PHOTO' }
  | { type: 'CAPTURE_PHOTO_START' }
  | { type: 'CAPTURE_PHOTO_RESULT'; result: ScannedReceiptResult }
  | { type: 'CAPTURE_PHOTO_FAILED'; message: string }
  | { type: 'SET_RECEIPT_DRAFT_FIELD'; field: keyof ReceiptDraft; value: string | boolean }
  | { type: 'SET_RECEIPT_MODE'; mode: 'quick' | 'detailed' }
  | { type: 'ADD_LINE_ITEM_DRAFT' }
  | { type: 'SET_LINE_ITEM_DRAFT_FIELD'; id: string; field: 'description' | 'amount' | 'cat' | 'deductible'; value: string | boolean }
  | { type: 'REMOVE_LINE_ITEM_DRAFT'; id: string }
  | { type: 'ADD_ADJUSTMENT_LINE_ITEM'; amount: number }
  | { type: 'SAVE_RECEIPT' } | { type: 'SCAN_ANOTHER' } | { type: 'VIEW_IN_TAX' }

  | { type: 'SET_AUTH_USER'; user: AuthUser | null }
  | { type: 'SET_REMOTE_VERSION'; version: string | null }
  | { type: 'OAUTH_LOGIN_COMPLETE' }
  | { type: 'APPLY_REMOTE_STATE'; payload: Partial<SyncPayload> }
  | { type: 'OPEN_AUTH_PANEL' } | { type: 'CLOSE_AUTH_PANEL' }
  | { type: 'OPEN_LEGAL'; doc: 'privacy' | 'terms' } | { type: 'CLOSE_LEGAL' }
  | { type: 'SET_NET_WORTH_HISTORY'; history: { date: string; value: number }[] }
  | { type: 'SET_USER_MODE'; mode: 'developer' | 'customer' }

  | { type: 'TOGGLE_AI_VIEW' }
  | { type: 'START_NEW_AI_CHAT' }
  | { type: 'OPEN_AI_HISTORY_CHAT'; messages: AppState['aiMessages'] }
  | { type: 'SET_AI_INPUT'; value: string }
  | { type: 'SUBMIT_AI_TEXT_USER'; text: string; replyTo?: { from: 'user' | 'ai'; text: string } }
  | { type: 'SUBMIT_AI_TEXT_REPLY'; text: string }

  | { type: 'SET_MOUNTED' }
  | { type: 'HYDRATE'; state: AppState };

function updateManual(state: AppState, fn: (m: ManualData) => ManualData): AppState {
  return { ...state, ob: { ...state.ob, manual: fn(state.ob.manual) } };
}

function applyBalanceDelta(list: { id: string; amount: string | number; history?: { id: string; amount: number; desc: string; date: string }[] }[], id: string, delta: number, desc: string, date: string) {
  const entry = { id: uid(), amount: delta, desc, date: date || todayIso() };
  return list.map((r) => r.id !== id ? r : { ...r, amount: (parseFloat(String(r.amount)) || 0) + delta, history: [...(r.history || []), entry] });
}

function removeBalanceEntryFrom(list: { id: string; amount: string | number; history?: { id: string; amount: number; desc: string; date: string }[] }[], id: string, entryId: string) {
  return list.map((r) => {
    if (r.id !== id) return r;
    const entry = (r.history || []).find((h) => h.id === entryId);
    const amount = entry ? (parseFloat(String(r.amount)) || 0) - entry.amount : r.amount;
    return { ...r, amount, history: (r.history || []).filter((h) => h.id !== entryId) };
  });
}

function isSeedKey(listKey: string) {
  return listKey.startsWith('seed.');
}
function seedKeyName(listKey: string) {
  return listKey.slice(5) as 'cash' | 'creditCards' | 'investments';
}

function reviewPending(items: ReviewItem[], decisions: Record<string, string>): ReviewItem[] {
  return items.filter((i) => !decisions[i.id]);
}

// An accepted (or auto-added) ReviewItem, with whatever edits the user made
// on the card, becomes exactly one Transaction. `merchant` on the tx holds
// the user-facing expense name (same role it plays for receipt scans);
// tax/reliefKey come from the item's own taxDeductible flag, and only an
// expense can be deductible.
function txFromReviewItem(item: ReviewItem): Transaction {
  const dateLabel = item.dateIso ? isoToDisplayDate(item.dateIso) : (item.dateLabel || todayDisplayDate());
  const isExpense = item.amount < 0;
  const deductible = isExpense && !!item.taxDeductible;
  const reliefKey = deductible ? (categoryToReliefKey(item.cat) ?? undefined) : undefined;
  return {
    id: 'rev-' + item.id,
    merchant: item.name || item.merchant,
    cat: item.cat,
    dateLabel,
    dateGroup: dateGroupFor(dateLabel),
    month: monthFromDateLabel(dateLabel),
    amount: item.amount,
    tax: deductible,
    brand: item.brand,
    payment: item.payment,
    reliefKey,
  };
}

// After logging a spend, decide whether to offer adding its category to
// the budget: only for a real (budgetable) transaction category — the ones
// selectBudgets tracks, i.e. CAT_ICON keys — that isn't already a budget
// category anywhere and hasn't been "not now"-ed this session. Returns the
// pending prompt, or null to leave state.budgetPrompt as-is.
function budgetPromptFor(state: AppState, cat: string, amount: number): AppState['budgetPrompt'] {
  if (state.budgetPrompt) return state.budgetPrompt; // one at a time
  if (!cat || cat === 'Income' || !CAT_ICON[cat]) return null;
  if (state.budgetPromptDismissed.includes(cat)) return null;
  const alreadyBudgeted = state.finance.buckets.some((b) => b.categories.some((c) => c.name === cat));
  if (alreadyBudgeted) return null;
  return { cat, amount: Math.round(Math.abs(amount)) };
}

// Overlay a merchantMemory hit onto an incoming review item: remembered
// category / name / payment / tax flag win, the item is flagged `learned`,
// and a well-established merchant (confirmed >= 2x) is flagged `autoAdd`.
function applyMerchantMemory(item: ReviewItem, mem: AppState['merchantMemory']): ReviewItem {
  const remembered = lookupMerchantMemory(mem, item.merchant);
  if (!remembered) return item;
  const next: ReviewItem = {
    ...item,
    cat: remembered.category ?? item.cat,
    name: remembered.name ?? item.name,
    payment: remembered.payment ?? item.payment,
    taxDeductible: remembered.taxDeductible ?? item.taxDeductible,
    learned: true,
  };
  if ((remembered.confirmedCount ?? 0) >= 2) next.autoAdd = true;
  return next;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_MOUNTED':
      return { ...state, mounted: true };

    // ---- onboarding ----
    case 'SET_OB_FIELD':
      return { ...state, ob: { ...state.ob, [action.field]: action.value } };
    case 'SET_OB_OTHER':
      return { ...state, ob: { ...state.ob, otherText: { ...state.ob.otherText, [action.field]: action.value } } };
    case 'TOGGLE_OB_ARRAY': {
      const arr = state.ob[action.field];
      const next = arr.includes(action.value) ? arr.filter((v) => v !== action.value) : [...arr, action.value];
      return { ...state, ob: { ...state.ob, [action.field]: next } };
    }
    case 'SET_OB_GOAL_DETAIL': {
      // key === null → the primary goal changed: wipe every follow-up answer
      // and any monthly savings figure derived from the previous goal.
      if (action.key === null) {
        return { ...state, ob: { ...state.ob, goalDetail: {}, savingsTarget: '' } };
      }
      const goalDetail = { ...state.ob.goalDetail, [action.key]: action.value ?? '' };
      return {
        ...state,
        ob: { ...state.ob, goalDetail, savingsTarget: deriveObSavingsTarget(state.ob.primaryGoal, goalDetail) },
      };
    }
    case 'OB_NEXT':
      return { ...state, obStep: action.nextStep };
    case 'OB_BACK':
      return { ...state, obStep: action.prevStep };
    case 'OB_FINISH':
      // Defensive: nothing set during onboarding should leave a detail
      // overlay auto-open the moment the user lands on the real app shell.
      // Adding an account/card/property/asset during the manual finances
      // step sets balanceDetailOpen (and investDetailOpen for an invest
      // row); clear every overlay key, not just the budget one (H1).
      return {
        ...state,
        appStage: 'app',
        tab: 'home',
        budgetItemDetailOpen: null,
        balanceDetailOpen: null,
        investDetailOpen: null,
        historyOpen: null,
        txDetailOpen: null,
      };
    case 'TOGGLE_AGREED_TERMS':
      return { ...state, ob: { ...state.ob, agreedTerms: !state.ob.agreedTerms } };
    case 'CHOOSE_SETUP_METHOD':
      return { ...state, obStep: action.nextStep, ob: { ...state.ob, setupMethod: action.method } };
    case 'TOGGLE_LINK_TARGET_START':
      return { ...state, ob: { ...state.ob, connectingId: action.id } };
    case 'TOGGLE_LINK_TARGET_COMPLETE':
      return { ...state, ob: { ...state.ob, connectingId: null, linkedIds: [...state.ob.linkedIds, action.id] } };
    case 'TOGGLE_LINK_TARGET_REMOVE':
      return { ...state, ob: { ...state.ob, linkedIds: state.ob.linkedIds.filter((x) => x !== action.id) } };
    case 'RESET_ONBOARDING':
      return state; // side effect (localStorage clear + reload) handled by caller
    case 'LOAD_TRIAL_DATA': {
      const trial = buildTrialData();
      return {
        ...state,
        ob: { ...state.ob, manual: { ...state.ob.manual, bankAccounts: trial.manual.bankAccounts, creditCards: trial.manual.creditCards, investments: trial.manual.investments }, subs: trial.subs },
        transactions: trial.transactions,
        receipts: [],
        finance: { buckets: trial.buckets },
        pendingReviewItems: trial.pendingReviewItems, reviewDecisions: {},
        merchantMemory: {}, autoAddedThisImport: [], recurGeneratedMonths: {},
      };
    }
    case 'CLEAR_ALL_DATA': {
      const empty = emptyTrialData();
      return {
        ...state,
        ob: { ...state.ob, manual: { ...state.ob.manual, bankAccounts: empty.manual.bankAccounts, creditCards: empty.manual.creditCards, investments: empty.manual.investments }, subs: empty.subs },
        transactions: empty.transactions,
        receipts: [],
        finance: { buckets: empty.buckets },
        pendingReviewItems: [], reviewDecisions: {},
        merchantMemory: {}, autoAddedThisImport: [], recurGeneratedMonths: {},
        netWorthSeed: defaultNetWorthSeed(),
      };
    }

    // ---- navigation ----
    case 'GO_TAB':
      return { ...state, tab: action.tab, morePanelOpen: false, notifPanelOpen: false };
    case 'OPEN_MORE_PANEL':
      return { ...state, morePanelOpen: true, notifPanelOpen: false };
    case 'CLOSE_MORE_PANEL':
      return { ...state, morePanelOpen: false };
    case 'OPEN_NOTIF_PANEL':
      return { ...state, notifPanelOpen: true, morePanelOpen: false };
    case 'CLOSE_NOTIF_PANEL':
      return { ...state, notifPanelOpen: false };
    case 'GO_FINANCE_SECTION':
      return { ...state, tab: 'finance', financeSection: action.section };

    // ---- net worth chart ----
    case 'SET_NETWORTH_RANGE':
      return { ...state, netWorthRange: action.range, nwSelectedIdx: null };
    case 'SELECT_NW_POINT':
      return { ...state, nwSelectedIdx: action.idx };

    // ---- record / history ----
    case 'SET_HISTORY_MONTH':
      return { ...state, historyMonth: action.month };
    case 'SET_HISTORY_YEAR':
      return { ...state, historyYear: action.year };
    case 'SET_RECORD_RANGE':
      return { ...state, recordDateFrom: action.from, recordDateTo: action.to };
    case 'SET_TX_SEARCH':
      return { ...state, txSearch: action.value };
    case 'SET_TX_FILTER':
      return { ...state, txFilter: action.value };

    // ---- stats ----
    case 'SET_STATS_PERIOD':
      return { ...state, statsPeriod: action.value };
    case 'OPEN_STATS_CATEGORY_DETAIL':
      return { ...state, statsCategoryDetail: action.cat };
    case 'CLOSE_STATS_CATEGORY_DETAIL':
      return { ...state, statsCategoryDetail: null };

    // ---- tax profile (settings) ----
    case 'OPEN_TAX_PROFILE':
      return { ...state, taxProfileOpen: true, morePanelOpen: false };
    case 'CLOSE_TAX_PROFILE':
      return { ...state, taxProfileOpen: false };

    // ---- donate ----
    case 'OPEN_DONATE':
      return { ...state, donateOpen: true, donateDone: false, morePanelOpen: false, notifPanelOpen: false };
    case 'CLOSE_DONATE':
      return { ...state, donateOpen: false };
    case 'SET_DONATE_AMOUNT':
      return { ...state, donateAmount: action.value };
    case 'SUBMIT_DONATE':
      return { ...state, donateDone: true };

    // ---- scan payment method ----
    case 'SET_SCAN_PAYMENT_METHOD':
      return { ...state, scanPaymentMethod: action.value, scanError: null };

    // ---- budgets ----
    case 'TOGGLE_BUCKET':
      return { ...state, expandedBucket: state.expandedBucket === action.key ? null : action.key };
    case 'ADD_BUCKET_CATEGORY': {
      const base = mkCategory(action.name ?? 'New category', clampCap(action.cap ?? 0), action.name ? [] : [mkItem('New item', 0)]);
      // Fixed-bucket categories (rent, utilities, loans) repeat every month
      // by default; everything else is opt-in.
      const cat = action.bucketKey === 'fixed' ? { ...base, recurring: true, recurDay: 1 } : base;
      return {
        ...state,
        finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: [...b.categories, cat] }) },
        budgetItemDetailOpen: action.openDetail === false ? state.budgetItemDetailOpen : action.bucketKey + ':' + cat.id,
      };
    }
    case 'REMOVE_BUCKET_CATEGORY':
      return {
        ...state,
        finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.filter((c) => c.id !== action.catId) }) },
        budgetItemDetailOpen: null,
      };
    case 'SET_BUCKET_CATEGORY_NAME':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, name: action.value }) }) } };
    case 'SET_BUCKET_CATEGORY_CAP':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, cap: clampCap(action.value) }) }) } };
    case 'SET_BUCKET_CATEGORY_RECURRING':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, recurring: action.on, recurDay: c.recurDay ?? 1 }) }) } };
    case 'SET_BUCKET_CATEGORY_RECUR_DAY':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, recurDay: Math.min(28, Math.max(1, Math.round(action.day) || 1)) }) }) } };
    case 'MATERIALIZE_RECURRING': {
      const r = materializeRecurring(state);
      if (!r) return state;
      return { ...state, transactions: [...state.transactions, ...r.transactions], recurGeneratedMonths: r.generated };
    }
    case 'ADD_BUCKET_ITEM':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, items: [...c.items, mkItem('', 0)] }) }) } };
    case 'SET_BUCKET_ITEM_FIELD':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, items: c.items.map((it) => it.id !== action.itemId ? it : { ...it, [action.field]: action.value }) }) }) } };
    case 'REMOVE_BUCKET_ITEM':
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, items: c.items.filter((it) => it.id !== action.itemId) }) }) } };
    case 'OPEN_BUDGET_ITEM_DETAIL':
      return { ...state, budgetItemDetailOpen: action.key, donutExpanded: false };
    case 'CLOSE_BUDGET_ITEM_DETAIL':
      return { ...state, budgetItemDetailOpen: null };
    case 'TOGGLE_DONUT_EXPANDED':
      return { ...state, donutExpanded: !state.donutExpanded };

    // ---- tax ----
    case 'SET_TAX_YEAR':
      return { ...state, taxYear: action.year, expandedTaxGroup: null, taxItemDetailOpen: null };
    case 'TOGGLE_TAX_GROUP':
      return { ...state, expandedTaxGroup: state.expandedTaxGroup === action.key ? null : action.key };
    case 'OPEN_TAX_ITEM_DETAIL':
      return { ...state, taxItemDetailOpen: action.key };
    case 'CLOSE_TAX_ITEM_DETAIL':
      return { ...state, taxItemDetailOpen: null };
    case 'OPEN_TAX_RECEIPTS':
      return { ...state, taxReceiptsOpen: true };
    case 'CLOSE_TAX_RECEIPTS':
      return { ...state, taxReceiptsOpen: false };
    case 'OPEN_TAX_PACK':
      return { ...state, taxPackOpen: true, morePanelOpen: false, notifPanelOpen: false };
    case 'CLOSE_TAX_PACK':
      return { ...state, taxPackOpen: false };
    case 'UPGRADE_FROM_TAX_PACK':
      return { ...state, subscriptionTier: 'premium', taxPackOpen: false };
    case 'TOGGLE_SUBSCRIPTION_TIER':
      return { ...state, subscriptionTier: state.subscriptionTier === 'premium' ? 'free' : 'premium' };

    // ---- settings ----
    case 'SET_FACE_ID':
      return { ...state, faceIdEnabled: action.on };
    case 'TOGGLE_FACE_ID':
      return { ...state, faceIdEnabled: !state.faceIdEnabled };
    case 'TOGGLE_SETTING':
      return { ...state, settingsToggles: { ...state.settingsToggles, [action.key]: !state.settingsToggles[action.key] } };
    case 'SET_THEME':
      return { ...state, theme: action.theme };

    // ---- manual records (assets/liabilities/investments) ----
    case 'ADD_RECORD': {
      // The new row's id is generated here (not inside mkRecord) so it can
      // also open the record's detail dialog immediately -- there's no more
      // inline-edit row for a blank record to land in, so without this it
      // would sit invisible/unnamed in the compact list.
      const id = uid();
      const next = updateManual(state, (m) => ({ ...m, [action.listKey]: [...(m[action.listKey] as any[]), { id, name: '', amount: '', date: todayIso(), history: [] }] }));
      return { ...next, balanceDetailOpen: action.listKey + ':' + id, balanceDraft: { mode: 'add', amount: '', desc: '', date: todayIso() } };
    }
    case 'SET_RECORD_FIELD':
      return updateManual(state, (m) => ({ ...m, [action.listKey]: (m[action.listKey] as any[]).map((r) => r.id === action.id ? { ...r, [action.field]: action.value } : r) }));
    case 'REMOVE_RECORD':
      return updateManual(state, (m) => ({ ...m, [action.listKey]: (m[action.listKey] as any[]).filter((r) => r.id !== action.id) }));
    case 'ADD_INVESTMENT_ROW': {
      const id = uid();
      const next = updateManual(state, (m) => ({ ...m, investments: [...m.investments, { id, name: '', qty: '', buy: '', cur: '' }] }));
      return { ...next, investDetailOpen: 'investments:' + id };
    }
    case 'REMOVE_INVESTMENT_ROW':
      return updateManual(state, (m) => ({ ...m, investments: m.investments.filter((_, i) => i !== action.idx) }));
    case 'SET_INVEST_FIELD':
      return updateManual(state, (m) => {
        const investments = m.investments.slice();
        investments[action.idx] = { ...investments[action.idx], [action.field]: action.value };
        return { ...m, investments };
      });

    // ---- subscriptions ----
    case 'SET_SUB_DRAFT_FIELD': {
      const nextDraft = { ...state.ob.subDraft, [action.field]: action.value };
      // Auto-suggest "next payment" from the start date + frequency
      // whenever either changes — still a real, independently editable
      // field afterward (a direct edit to nextPayment itself doesn't hit
      // this branch, so a manual override sticks until start/frequency
      // change again).
      if ((action.field === 'startDate' || action.field === 'frequency') && nextDraft.startDate) {
        nextDraft.nextPayment = computeNextPayment(nextDraft.startDate, nextDraft.frequency);
      }
      // Installment plan: keep the per-installment `amount` auto-filled from
      // total ÷ count whenever either changes. A direct edit to `amount`
      // itself doesn't hit this branch, so a manual override sticks until
      // total / count change again (same pattern as nextPayment above).
      if ((action.field === 'totalAmount' || action.field === 'totalInstallments') && nextDraft.kind === 'plan') {
        const total = parseFloat(String(nextDraft.totalAmount)) || 0;
        const count = Number(nextDraft.totalInstallments) || 0;
        if (total > 0 && count > 0) nextDraft.amount = (Math.round((total / count) * 100) / 100).toFixed(2);
      }
      return { ...state, ob: { ...state.ob, subDraft: nextDraft } };
    }
    case 'ADD_SUBSCRIPTION': {
      const d = state.ob.subDraft;
      // Reject a missing name or a non-positive amount — a negative amount
      // would render as positive (money() abs's it) while quietly subtracting
      // from the monthly/yearly subscription totals. `amount` is the
      // per-installment charge for a plan, so the same guard applies.
      if (!d.name || !(parseFloat(d.amount) > 0)) return state;
      const isPlan = d.kind === 'plan';
      // A plan with no tenure isn't a plan — reject rather than store one
      // that divides by zero everywhere downstream.
      if (isPlan && !(Number(d.totalInstallments) > 0)) return state;
      const total = Number(d.totalInstallments) || 0;
      const paid = Math.max(0, Math.min(Number(d.paidInstallments) || 0, total));
      const record: Subscription = isPlan
        ? {
            kind: 'plan',
            name: d.name, amount: d.amount, frequency: d.frequency || 'Monthly',
            startDate: d.startDate, nextPayment: d.nextPayment, method: d.method, category: d.category,
            provider: d.provider || 'Other', totalAmount: d.totalAmount || '',
            totalInstallments: total, paidInstallments: paid,
            interestRate: d.interestRate || '0',
            archived: paid >= total,
          }
        : {
            kind: 'subscription',
            name: d.name, amount: d.amount, frequency: d.frequency,
            startDate: d.startDate, nextPayment: d.nextPayment, method: d.method, category: d.category,
          };
      return {
        ...state,
        ob: {
          ...state.ob,
          subs: [...state.ob.subs, record],
          subDraft: {
            name: '', amount: '', frequency: 'Monthly', startDate: '', nextPayment: '', method: 'Cash', category: 'Entertainment',
            kind: 'subscription' as const, provider: 'Atome', totalAmount: '',
            totalInstallments: 3, paidInstallments: 0, interestRate: '0', archived: false,
          },
        },
        addSubOpen: false,
      };
    }
    case 'REMOVE_SUBSCRIPTION':
      return { ...state, ob: { ...state.ob, subs: state.ob.subs.filter((_, i) => i !== action.idx) } };
    case 'MARK_PLAN_PAYMENT_MADE': {
      // Bump paidInstallments on the plan at idx (no-op on a subscription or
      // an already-complete plan) and archive it once the last payment lands.
      const subs = state.ob.subs.map((s, i) => {
        if (i !== action.idx || s.kind !== 'plan') return s;
        const total = Number(s.totalInstallments) || 0;
        const paid = Math.min(total, (Number(s.paidInstallments) || 0) + 1);
        return { ...s, paidInstallments: paid, archived: paid >= total };
      });
      return { ...state, ob: { ...state.ob, subs } };
    }
    case 'OPEN_ADD_SUB':
      return { ...state, addSubOpen: true };
    case 'CLOSE_ADD_SUB':
      return { ...state, addSubOpen: false };

    // ---- balance detail (net worth edit) ----
    case 'OPEN_BALANCE_DETAIL':
      return { ...state, balanceDetailOpen: action.listKey + ':' + action.id, balanceDraft: { mode: 'add', amount: '', desc: '', date: todayIso() } };
    case 'CLOSE_BALANCE_DETAIL':
      return { ...state, balanceDetailOpen: null };
    case 'SET_BALANCE_DRAFT_FIELD':
      return { ...state, balanceDraft: { ...state.balanceDraft, [action.field]: action.value } };
    case 'SUBMIT_BALANCE_ENTRY': {
      const amt = parseFloat(state.balanceDraft.amount) || 0;
      if (!amt) return state;
      const delta = state.balanceDraft.mode === 'deduct' ? -amt : amt;
      const { desc, date } = state.balanceDraft;
      const nextState = isSeedKey(action.listKey)
        ? { ...state, netWorthSeed: { ...state.netWorthSeed, [seedKeyName(action.listKey)]: applyBalanceDelta(state.netWorthSeed[seedKeyName(action.listKey)] as any, action.id, delta, desc, date) } }
        : updateManual(state, (m) => ({ ...m, [action.listKey]: applyBalanceDelta(m[action.listKey as ManualListKey] as any, action.id, delta, desc, date) }));
      return { ...nextState, balanceDraft: { mode: 'add', amount: '', desc: '', date: todayIso() } };
    }
    case 'REMOVE_BALANCE_ENTRY': {
      return isSeedKey(action.listKey)
        ? { ...state, netWorthSeed: { ...state.netWorthSeed, [seedKeyName(action.listKey)]: removeBalanceEntryFrom(state.netWorthSeed[seedKeyName(action.listKey)] as any, action.id, action.entryId) } }
        : updateManual(state, (m) => ({ ...m, [action.listKey]: removeBalanceEntryFrom(m[action.listKey as ManualListKey] as any, action.id, action.entryId) }));
    }
    case 'OPEN_HISTORY':
      return { ...state, historyOpen: action.listKey + ':' + action.id };
    case 'CLOSE_HISTORY':
      return { ...state, historyOpen: null };

    // ---- transaction detail (Record row tap: edit/delete) ----
    case 'OPEN_TX_DETAIL': {
      const tx = state.transactions.find((t) => t.id === action.id);
      if (!tx) return state;
      return {
        ...state, txDetailOpen: action.id,
        txDraft: {
          merchant: tx.merchant, cat: tx.cat, amount: String(Math.abs(tx.amount)),
          type: tx.amount >= 0 ? 'income' : 'expense', date: displayDateToIso(tx.dateLabel),
          tax: tx.tax, payment: tx.payment,
        },
      };
    }
    case 'CLOSE_TX_DETAIL':
      return { ...state, txDetailOpen: null };
    case 'SET_TX_DRAFT_FIELD': {
      // Picking "Income" always resets the category to Income (it's the
      // only category that pairs with a positive amount) rather than
      // leaving a stale expense category selected underneath a hidden
      // picker; switching back to "Expense" hands the category back.
      const draft = { ...state.txDraft, [action.field]: action.value };
      if (action.field === 'type') {
        draft.cat = action.value === 'income' ? 'Income' : (state.txDraft.cat === 'Income' ? 'Food & Drink' : state.txDraft.cat);
      }
      return { ...state, txDraft: draft };
    }
    case 'SAVE_TX_DETAIL': {
      if (!state.txDetailOpen) return state;
      const amt = parseFloat(state.txDraft.amount) || 0;
      if (!state.txDraft.merchant || !amt) return state;
      const dateLabel = isoToDisplayDate(state.txDraft.date) || todayDisplayDate();
      const signedAmount = state.txDraft.type === 'income' ? amt : -amt;
      const reliefKey = state.txDraft.tax && state.txDraft.type === 'expense' ? (categoryToReliefKey(state.txDraft.cat) ?? undefined) : undefined;
      const id = state.txDetailOpen;
      const transactions = state.transactions.map((t) => t.id !== id ? t : {
        ...t, merchant: state.txDraft.merchant, cat: state.txDraft.cat, amount: signedAmount,
        dateLabel, dateGroup: dateGroupFor(dateLabel), month: monthFromDateLabel(dateLabel),
        tax: state.txDraft.tax, reliefKey, payment: state.txDraft.payment,
      });
      return { ...state, transactions, txDetailOpen: null };
    }
    case 'DELETE_TX_DETAIL': {
      if (!state.txDetailOpen) return state;
      return { ...state, transactions: state.transactions.filter((t) => t.id !== state.txDetailOpen), txDetailOpen: null };
    }

    case 'TOGGLE_NW_GROUP':
      return { ...state, expandedNwGroup: state.expandedNwGroup === action.key ? null : action.key };
    case 'OPEN_INVEST_DETAIL':
      return { ...state, investDetailOpen: action.listKey + ':' + action.id };
    case 'CLOSE_INVEST_DETAIL':
      return { ...state, investDetailOpen: null };
    case 'SET_INVEST_DETAIL_FIELD': {
      const apply = (list: any[]) => list.map((r) => r.id === action.id ? { ...r, [action.field]: action.value } : r);
      return isSeedKey(action.listKey)
        ? { ...state, netWorthSeed: { ...state.netWorthSeed, [seedKeyName(action.listKey)]: apply(state.netWorthSeed[seedKeyName(action.listKey)] as any) } }
        : updateManual(state, (m) => ({ ...m, [action.listKey]: apply(m[action.listKey as ManualListKey] as any) }));
    }

    // ---- swipe-to-confirm (transaction list) — drag delta is component-local; only the
    // final confirm commits to global state. See TransactionRow.
    case 'SWIPE_CONFIRM':
      return { ...state, confirmedIds: { ...state.confirmedIds, [action.id]: true } };

    // ---- review / import ----
    case 'OPEN_REVIEW':
      return { ...state, reviewOpen: true };
    case 'CLOSE_REVIEW':
      // autoAddedThisImport is per-import; drop it so the "N added
      // automatically" banner doesn't resurface on the next unrelated open.
      return { ...state, reviewOpen: false, autoAddedThisImport: [] };
    case 'ADD_PENDING_REVIEW_ITEMS': {
      const enriched = action.items.map((it) => applyMerchantMemory(it, state.merchantMemory));
      // Auto-add items never enter the deck: commit them straight to
      // transactions and mark them 'accept'-decided so selectReviewFlow
      // skips them. They stay in pendingReviewItems so UNDO_AUTO_ADDED can
      // push them back as normal cards.
      const autoItems = enriched.filter((it) => it.autoAdd);
      let transactions = state.transactions;
      const decisions = { ...state.reviewDecisions };
      const autoAddedIds: string[] = [];
      for (const it of autoItems) {
        transactions = [...transactions, txFromReviewItem(it)];
        decisions[it.id] = 'accept';
        autoAddedIds.push('rev-' + it.id);
      }
      return {
        ...state,
        pendingReviewItems: [...state.pendingReviewItems, ...enriched],
        reviewDecisions: decisions,
        transactions,
        autoAddedThisImport: [...state.autoAddedThisImport, ...autoAddedIds],
      };
    }
    case 'UPDATE_REVIEW_ITEM':
      return {
        ...state,
        pendingReviewItems: state.pendingReviewItems.map((it) =>
          it.id === action.id ? { ...it, ...action.patch } : it),
      };
    case 'UNDO_AUTO_ADDED': {
      if (state.autoAddedThisImport.length === 0) return state;
      const txIds = new Set(state.autoAddedThisImport);
      const itemIds = new Set(state.autoAddedThisImport.map((t) => t.replace(/^rev-/, '')));
      const reviewDecisions = { ...state.reviewDecisions };
      for (const id of itemIds) delete reviewDecisions[id];
      return {
        ...state,
        transactions: state.transactions.filter((t) => !txIds.has(String(t.id))),
        reviewDecisions,
        pendingReviewItems: state.pendingReviewItems.map((it) =>
          itemIds.has(it.id) ? { ...it, autoAdd: false, learned: false } : it),
        autoAddedThisImport: [],
      };
    }
    case 'SET_STATEMENT_UPLOADING':
      return { ...state, statementUploading: action.value };
    case 'SET_STATEMENT_UPLOAD_ERROR':
      return { ...state, statementUploadError: action.message };
    case 'CONFIRM_BUDGET_PROMPT': {
      if (!state.budgetPrompt) return state;
      const cat = mkCategory(state.budgetPrompt.cat, clampCap(action.cap), []);
      return {
        ...state,
        finance: {
          ...state.finance,
          // Scanned-receipt categories are variable spending — the Flexible bucket.
          buckets: state.finance.buckets.map((b) => b.key !== 'flexible' ? b : { ...b, categories: [...b.categories, cat] }),
        },
        budgetPrompt: null,
        budgetPromptDismissed: [...state.budgetPromptDismissed, state.budgetPrompt.cat],
      };
    }
    case 'DISMISS_BUDGET_PROMPT':
      return {
        ...state,
        budgetPrompt: null,
        budgetPromptDismissed: state.budgetPrompt
          ? [...state.budgetPromptDismissed, state.budgetPrompt.cat]
          : state.budgetPromptDismissed,
      };
    case 'REVIEW_DECIDE': {
      const pending = reviewPending(state.pendingReviewItems, state.reviewDecisions);
      const item = pending[0];
      if (!item) return state;
      let transactions = state.transactions;
      let merchantMemory = state.merchantMemory;
      let budgetPrompt = state.budgetPrompt;
      if (action.dir === 'accept') {
        // The transaction is built from the (possibly edited) item — its
        // final name / date / category / payment / tax flag / signed amount.
        transactions = [...state.transactions, txFromReviewItem(item)];
        // Learn this merchant for the next import (per-account memory).
        merchantMemory = upsertMerchantMemory(merchantMemory, {
          merchant: item.merchant, cat: item.cat, name: item.name || item.merchant,
          payment: item.payment, taxDeductible: !!item.taxDeductible,
        });
        // Offer to budget an expense category that isn't tracked yet.
        if (item.amount < 0) budgetPrompt = budgetPromptFor(state, item.cat, item.amount);
      }
      return { ...state, reviewDecisions: { ...state.reviewDecisions, [item.id]: action.dir }, reviewDragging: false, reviewDragX: 0, transactions, merchantMemory, budgetPrompt };
    }
    case 'REVIEW_DOWN':
      return { ...state, reviewDragging: true, reviewDragStartX: action.clientX, reviewDragX: 0 };
    case 'REVIEW_MOVE':
      if (!state.reviewDragging) return state;
      return { ...state, reviewDragX: clamp(action.clientX - state.reviewDragStartX, -160, 160) };
    case 'REVIEW_UP':
      if (!state.reviewDragging) return state;
      if (state.reviewDragX > 90) return reducer(state, { type: 'REVIEW_DECIDE', dir: 'accept' });
      if (state.reviewDragX < -90) return reducer(state, { type: 'REVIEW_DECIDE', dir: 'reject' });
      return { ...state, reviewDragging: false, reviewDragX: 0 };

    // ---- scan / capture receipt ----
    case 'OPEN_SCAN':
      return { ...state, ...freshScanFields(), scanOpen: true, scanFrom: state.tab };
    case 'CLOSE_SCAN':
      // Leave scanStep / receiptDraft untouched here so the close animation
      // (ScanFlow keeps the last step mounted for ~300ms) doesn't visibly
      // swap to a fresh capture screen mid-fade. OPEN_SCAN / SCAN_ANOTHER do
      // the full reset before the next receipt starts.
      return { ...state, scanOpen: false };
    case 'CHOOSE_MANUAL':
      // True manual entry -- fields stay blank, no simulated OCR result.
      // Clears any error left over from a failed scan ("Add custom amount").
      return { ...state, scanStep: 'review', scanMethod: 'manual', scanError: null, receiptDraft: blankReceiptDraft(todayIso()), lineItemDrafts: [] };
    // A photo has been captured (live camera or Photo/File picker) but not
    // yet sent for OCR -- the file itself stays in local component state
    // (see ScanFlow's pendingPhoto), this just advances the screen so the
    // user can confirm or retake before any processing starts.
    case 'PREVIEW_CAPTURED_PHOTO':
      return { ...state, scanStep: 'preview' };
    // "Snap again" from either the preview screen or the unable-to-scan
    // screen -- back to a live capture, clearing any previous scan error.
    case 'RETAKE_PHOTO':
      return { ...state, scanStep: 'capture', scanError: null };
    case 'CAPTURE_PHOTO_START':
      return { ...state, scanStep: 'processing', scanError: null };
    case 'CAPTURE_PHOTO_RESULT': {
      const r = action.result;
      const lineItemDrafts = r.lineItems.map((li) => mkLineItemDraft({
        description: li.description, amount: li.amount ? li.amount.toFixed(2) : '',
        cat: mapOcrCategory(li.category), deductible: li.taxDeductible,
        confidence: li.confidence, touched: false,
      }));
      const scannedVendor = r.vendor && r.vendor !== 'Unknown vendor' ? r.vendor : '';

      // "Expense name" should read as what was bought, not the store. The
      // Tesseract fallback emits one "line item" that just echoes the vendor
      // name — ignore that so it doesn't become the expense name too.
      const itemNames = r.lineItems
        .map((li) => (li.description || '').trim())
        .filter((d) => d
          && d.toLowerCase() !== scannedVendor.toLowerCase()
          && d.toLowerCase() !== 'unknown vendor');
      let expenseName = '';
      if (itemNames.length === 1) {
        expenseName = itemNames[0].slice(0, 40);
      } else if (itemNames.length > 1) {
        const head = itemNames[0].length <= 34 ? itemNames[0] : itemNames[0].slice(0, 33).trimEnd() + '…';
        expenseName = `${head} +${itemNames.length - 1} more`;
      }

      // Dominant category across the scanned items, weighted by amount — this
      // is what the category chip should be pre-selected to.
      const catWeight: Record<string, number> = {};
      r.lineItems.forEach((li) => {
        const c = mapOcrCategory(li.category);
        catWeight[c] = (catWeight[c] || 0) + (li.amount || 1);
      });
      const primaryCategory = Object.entries(catWeight).sort((a, b) => b[1] - a[1])[0]?.[0]
        || state.receiptDraft.quickCategory;

      // A single-item receipt (or a Tesseract fallback with none) lands in
      // quick mode: one expense name + one pre-selected category chip.
      // Multi-item receipts keep the per-line editor.
      const mode: 'quick' | 'detailed' = r.lineItems.length <= 1 ? 'quick' : 'detailed';

      // Payment method the scan detected (Cash / Credit Card / E-wallet /
      // Transfer), if any.
      const PM_OPTIONS = ['Cash', 'Credit Card', 'E-wallet', 'Transfer'];
      const scannedPayment = r.paymentMethod && PM_OPTIONS.includes(r.paymentMethod) ? r.paymentMethod : null;

      // If we've seen this vendor before (statement or receipt), let the
      // remembered category / tax flag / payment method pre-fill the draft.
      const remembered = lookupMerchantMemory(state.merchantMemory, scannedVendor);
      const draftCategory = remembered?.category ?? primaryCategory;

      return {
        ...state, scanStep: 'review', scanMethod: 'photo', scanError: null,
        scanPaymentMethod: remembered?.payment ?? scannedPayment ?? state.scanPaymentMethod,
        receiptDraft: {
          ...state.receiptDraft,
          // If the scan couldn't read a name, leave the field empty (with its
          // placeholder) rather than copying junk / a stale prior value.
          merchant: expenseName || scannedVendor,
          vendor: scannedVendor,
          date: r.date || state.receiptDraft.date,
          total: r.total != null ? r.total.toFixed(2) : '',
          quickCategory: draftCategory,
          tax: remembered?.taxDeductible ?? (categoryToReliefKey(draftCategory) != null),
          mode,
        },
        lineItemDrafts,
      };
    }
    case 'CAPTURE_PHOTO_FAILED':
      // The scanning service couldn't read this photo (or isn't reachable)
      // -- show the dedicated unable-to-scan interstitial rather than
      // silently dropping into the manual-entry form. scanMethod is left
      // as-is; it only becomes 'manual' once "Add custom amount" fires the
      // existing CHOOSE_MANUAL action. The raw message stays in state for
      // potential future debug/analytics use, but the interstitial itself
      // shows static copy, not this string.
      return { ...state, scanStep: 'unable', scanError: action.message };
    case 'SET_RECEIPT_DRAFT_FIELD': {
      const next = { ...state.receiptDraft, [action.field]: action.value };
      // Re-suggest deductibility whenever the category changes -- the user
      // can still flip it back with the Yes/No toggle right after; this
      // only sets the starting point so switching categories doesn't leave
      // a stale suggestion from the previous one.
      if (action.field === 'quickCategory') next.tax = categoryToReliefKey(action.value as string) != null;
      // Editing any field clears a "can't save yet" banner from a prior
      // attempt — the user is acting on it, don't leave it hanging.
      return { ...state, receiptDraft: next, scanError: null };
    }
    case 'SET_RECEIPT_MODE': {
      if (action.mode === state.receiptDraft.mode) return state;
      // Switching to Detailed with nothing typed yet seeds one line item
      // from the Quick fields, so a user who already typed a merchant/
      // total/category doesn't lose it switching modes.
      const lineItemDrafts = action.mode === 'detailed' && state.lineItemDrafts.length === 0 && state.receiptDraft.total
        ? [mkLineItemDraft({ description: state.receiptDraft.merchant || 'Item', amount: state.receiptDraft.total, cat: state.receiptDraft.quickCategory })]
        : state.lineItemDrafts;
      return { ...state, receiptDraft: { ...state.receiptDraft, mode: action.mode }, lineItemDrafts, scanError: null };
    }
    case 'ADD_LINE_ITEM_DRAFT':
      return { ...state, lineItemDrafts: [...state.lineItemDrafts, mkLineItemDraft()], scanError: null };
    case 'SET_LINE_ITEM_DRAFT_FIELD':
      return {
        ...state,
        scanError: null,
        lineItemDrafts: state.lineItemDrafts.map((it) => it.id !== action.id ? it : { ...it, [action.field]: action.value, touched: true }),
      };
    case 'REMOVE_LINE_ITEM_DRAFT':
      return { ...state, lineItemDrafts: state.lineItemDrafts.filter((it) => it.id !== action.id), scanError: null };
    case 'ADD_ADJUSTMENT_LINE_ITEM':
      return { ...state, lineItemDrafts: [...state.lineItemDrafts, mkLineItemDraft({ description: 'Discount / adjustment', amount: action.amount.toFixed(2), cat: 'Other' })], scanError: null };
    case 'SAVE_RECEIPT': {
      // Save is only reachable from the review step. Ignoring a dispatch
      // from any other step (notably 'saved') stops a double-tap or a
      // re-render from cloning the just-saved receipt off the still-filled
      // draft — the bug behind "I can't add more than one receipt".
      if (state.scanStep !== 'review') return state;
      const draft = state.receiptDraft;
      if (!draft.merchant.trim()) {
        return { ...state, scanError: 'Add an expense name before saving.' };
      }
      const dateLabel = isoToDisplayDate(draft.date) || todayDisplayDate();
      const receiptId = 'rcpt-' + uid();
      let newTransactions: Transaction[];
      let lineItemsTotal: number;

      if (draft.mode === 'quick') {
        const amount = parseFloat(draft.total) || 0;
        if (!amount) return { ...state, scanError: 'Enter the receipt amount before saving.' };
        lineItemsTotal = amount;
        const reliefKey = draft.tax ? categoryToReliefKey(draft.quickCategory) ?? undefined : undefined;
        newTransactions = [{
          id: 'rcpt-tx-' + uid(), merchant: draft.merchant, cat: draft.quickCategory,
          dateLabel, dateGroup: dateGroupFor(dateLabel), month: monthFromDateLabel(dateLabel),
          amount: -amount, tax: draft.tax, reliefKey, payment: state.scanPaymentMethod, receiptId,
        }];
      } else {
        const items = state.lineItemDrafts;
        if (items.length === 0) {
          return { ...state, scanError: 'Add at least one line item before saving.' };
        }
        if (items.some((it) => lineItemIsInvalid(it) || lineItemNeedsReview(it))) {
          return { ...state, scanError: 'Check the highlighted line items — each needs a description and an amount.' };
        }
        lineItemsTotal = 0;
        newTransactions = items.map((it) => {
          const amount = parseFloat(it.amount) || 0;
          lineItemsTotal += amount;
          const reliefKey = it.deductible ? (categoryToReliefKey(it.cat) ?? undefined) : undefined;
          return {
            id: 'rcpt-tx-' + uid(), merchant: it.description, cat: it.cat,
            dateLabel, dateGroup: dateGroupFor(dateLabel), month: monthFromDateLabel(dateLabel),
            amount: -amount, tax: it.deductible, payment: state.scanPaymentMethod, reliefKey, receiptId,
          } as Transaction;
        });
      }

      const receipt: Receipt = {
        id: receiptId, merchant: draft.merchant, vendor: draft.vendor || undefined, dateLabel,
        total: parseFloat(draft.total) || lineItemsTotal, lineItemsTotal,
        source: state.scanMethod === 'photo' ? 'scan' : 'manual',
      };

      // Learn this vendor from a Quick-mode save (one name + one category +
      // one tax decision). Detailed mode is left out on purpose — it has no
      // single category/tax answer to remember. No-op if there's no vendor.
      const merchantMemory = draft.mode === 'quick'
        ? upsertMerchantMemory(state.merchantMemory, {
            merchant: draft.vendor || draft.merchant,
            cat: draft.quickCategory,
            name: draft.merchant,
            payment: state.scanPaymentMethod,
            taxDeductible: draft.tax,
          })
        : state.merchantMemory;

      return {
        ...state, scanStep: 'saved', scanError: null,
        receipts: [...state.receipts, receipt],
        transactions: [...state.transactions, ...newTransactions],
        merchantMemory,
        budgetPrompt: draft.mode === 'quick'
          ? budgetPromptFor(state, draft.quickCategory, parseFloat(draft.total) || 0)
          : state.budgetPrompt,
      };
    }
    case 'SCAN_ANOTHER':
      return { ...state, ...freshScanFields() };
    case 'VIEW_IN_TAX':
      return { ...state, scanOpen: false, tab: 'tax' };

    // ---- ai assistant ----
    case 'TOGGLE_AI_VIEW':
      return { ...state, aiView: state.aiView === 'chat' ? 'history' : 'chat' };
    case 'START_NEW_AI_CHAT':
      return { ...state, aiView: 'chat', aiMessages: [] };
    case 'OPEN_AI_HISTORY_CHAT':
      return { ...state, aiView: 'chat', aiMessages: action.messages.slice() };
    case 'SET_AI_INPUT':
      return { ...state, aiInput: action.value };
    case 'SUBMIT_AI_TEXT_USER':
      return { ...state, aiMessages: [...state.aiMessages, { from: 'user', text: action.text, ...(action.replyTo ? { replyTo: action.replyTo } : {}) }], aiInput: '', aiTyping: true };
    case 'SUBMIT_AI_TEXT_REPLY':
      return { ...state, aiMessages: [...state.aiMessages, { from: 'ai', text: action.text }], aiTyping: false };

    // ---- accounts ----
    case 'SET_AUTH_USER':
      return { ...state, authUser: action.user };
    case 'SET_REMOTE_VERSION':
      return { ...state, remoteVersion: action.version };
    case 'OAUTH_LOGIN_COMPLETE':
      // Mirrors AuthForm's onSuccess={goNext} for the redirect-based Google
      // flow, which has no callback site to hook that into directly. Only
      // advances onboarding if that's genuinely where the user was — a
      // guest signing in from deep in the app via AuthPanel just gets the
      // panel closed, not shoved into onboarding.
      return { ...state, obStep: state.obStep === 'login' ? 'source' : state.obStep, authPanelOpen: false };
    case 'APPLY_REMOTE_STATE':
      return applySyncPayload(state, action.payload);
    case 'OPEN_AUTH_PANEL':
      return { ...state, authPanelOpen: true };
    case 'CLOSE_AUTH_PANEL':
      return { ...state, authPanelOpen: false };
    case 'OPEN_LEGAL':
      return { ...state, legalOpen: action.doc };
    case 'CLOSE_LEGAL':
      return { ...state, legalOpen: null };
    case 'SET_NET_WORTH_HISTORY': {
      // Recomputed wholesale from the dated balance rows/entries (see
      // computeNetWorthTimeline) every time one of them changes, rather than
      // upserted — a backdated entry needs to reorder/insert a point in the
      // middle of the timeline, not just touch the last one.
      const a = state.netWorthHistory, b = action.history;
      const unchanged = a.length === b.length && a.every((p, i) => p.date === b[i].date && p.value === b[i].value);
      return unchanged ? state : { ...state, netWorthHistory: b };
    }
    case 'SET_USER_MODE':
      return { ...state, userMode: action.mode };

    default:
      return state;
  }
}
