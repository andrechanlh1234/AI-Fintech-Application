// Reducer ported from Cukai v7.dc.html's action methods (lines 2069-2343).
// Each Action variant corresponds 1:1 to an original `this.xyz = (...) => this.setState(...)` method,
// so screen components can call `actions.xyz(...)` exactly as the original template called `{{xyz}}`.
import type { AppState, ManualData, BalanceDraft, TxDraft } from './types';
import { mkCategory, mkItem, defaultNetWorthSeed, type ReviewItem, type Transaction } from '../lib/seedData';
import { uid } from '../lib/ids';
import { clamp, isoToDisplayDate, displayDateToIso, computeNextPayment, todayIso, todayDisplayDate, dateGroupFor, parseDisplayDate } from '../lib/format';
import { categoryToReliefKey } from '../lib/taxEngine';
import { mapOcrCategory } from '../lib/constants';
import { buildTrialData, emptyTrialData } from '../lib/trialData';
import { applySyncPayload, type SyncPayload } from './initialState';
import type { AuthUser, ScannedReceipt } from '../lib/api';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A function, not a static object, so scanDate is always *today* — computed
// fresh each time the scan flow opens/resets, not frozen at module load.
function blankScanFields() {
  return {
    scanMerchant: '', scanAmount: '', scanDate: todayDisplayDate(),
    scanCategory: 'Food & Drink', scanDeductible: false, scanTag: '', scanMethod: 'manual' as const,
  };
}

// The month a scan/manual transaction actually happened in, derived from its
// real entered date label ("3 Jul 2026") — falls back to the real current
// month only if the label doesn't parse, never to a fixed placeholder month.
function monthFromDateLabel(label: string): string {
  return parseDisplayDate(label)?.month ?? SHORT_MONTHS[new Date().getMonth()];
}

type ManualListKey = keyof ManualData;

export type Action =
  | { type: 'SET_OB_FIELD'; field: string; value: unknown }
  | { type: 'SET_OB_OTHER'; field: string; value: string }
  | { type: 'TOGGLE_OB_ARRAY'; field: 'incomeTypes' | 'reliefs' | 'goals'; value: string }
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
  | { type: 'SELECT_RECORD_DAY'; month: string; day: number }
  | { type: 'SET_RECORD_MONTH'; month: string; year: number }
  | { type: 'SET_TX_SEARCH'; value: string }
  | { type: 'SET_TX_FILTER'; value: string }

  | { type: 'SET_STATS_PERIOD'; value: string }
  | { type: 'OPEN_STATS_CATEGORY_DETAIL'; cat: string }
  | { type: 'CLOSE_STATS_CATEGORY_DETAIL' }

  | { type: 'OPEN_TAX_PROFILE' } | { type: 'CLOSE_TAX_PROFILE' }
  | { type: 'OPEN_DONATE' } | { type: 'CLOSE_DONATE' }
  | { type: 'SET_DONATE_AMOUNT'; value: string } | { type: 'SUBMIT_DONATE' }

  | { type: 'TOGGLE_WHY_DEDUCTIBLE' }
  | { type: 'SET_SCAN_PAYMENT_METHOD'; value: string }
  | { type: 'SET_SCAN_TAX_AMOUNT'; value: string }
  | { type: 'SET_SCAN_TAX_RATE'; value: string }
  | { type: 'SET_SCAN_TAG'; value: string }

  | { type: 'TOGGLE_BUCKET'; key: string }
  | { type: 'ADD_BUCKET_CATEGORY'; bucketKey: string; name?: string; openDetail?: boolean; cap?: number }
  | { type: 'REMOVE_BUCKET_CATEGORY'; bucketKey: string; catId: string }
  | { type: 'SET_BUCKET_CATEGORY_NAME'; bucketKey: string; catId: string; value: string }
  | { type: 'SET_BUCKET_CATEGORY_CAP'; bucketKey: string; catId: string; value: number }
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

  | { type: 'SET_SUB_DRAFT_FIELD'; field: string; value: string }
  | { type: 'ADD_SUBSCRIPTION' }
  | { type: 'REMOVE_SUBSCRIPTION'; idx: number }
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
  | { type: 'SET_STATEMENT_UPLOADING'; value: boolean }
  | { type: 'SET_STATEMENT_UPLOAD_ERROR'; message: string | null }

  | { type: 'OPEN_SCAN' } | { type: 'CLOSE_SCAN' }
  | { type: 'CHOOSE_MANUAL' }
  | { type: 'CAPTURE_PHOTO_START' }
  | { type: 'CAPTURE_PHOTO_RESULT'; receipt: ScannedReceipt }
  | { type: 'CAPTURE_PHOTO_FAILED'; message: string }
  | { type: 'SET_SCAN_FIELD'; field: 'scanMerchant' | 'scanAmount' | 'scanDate' | 'scanCategory'; value: string }
  | { type: 'SET_SCAN_DEDUCTIBLE'; value: boolean }
  | { type: 'SAVE_SCAN' } | { type: 'SCAN_ANOTHER' } | { type: 'VIEW_IN_TAX' }

  | { type: 'SET_AUTH_USER'; user: AuthUser | null }
  | { type: 'OAUTH_LOGIN_COMPLETE' }
  | { type: 'APPLY_REMOTE_STATE'; payload: Partial<SyncPayload> }
  | { type: 'OPEN_AUTH_PANEL' } | { type: 'CLOSE_AUTH_PANEL' }
  | { type: 'OPEN_LEGAL'; doc: 'privacy' | 'terms' } | { type: 'CLOSE_LEGAL' }
  | { type: 'SET_RESET_TOKEN'; token: string | null }
  | { type: 'SET_NET_WORTH_HISTORY'; history: { date: string; value: number }[] }
  | { type: 'SET_USER_MODE'; mode: 'developer' | 'customer' }

  | { type: 'TOGGLE_AI_VIEW' }
  | { type: 'START_NEW_AI_CHAT' }
  | { type: 'OPEN_AI_HISTORY_CHAT'; messages: AppState['aiMessages'] }
  | { type: 'SET_AI_INPUT'; value: string }
  | { type: 'SUBMIT_AI_TEXT_USER'; text: string }
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
    case 'OB_NEXT':
      return { ...state, obStep: action.nextStep };
    case 'OB_BACK':
      return { ...state, obStep: action.prevStep };
    case 'OB_FINISH':
      // Defensive: nothing set during onboarding should leave a detail
      // overlay auto-open the moment the user lands on the real app shell.
      return { ...state, appStage: 'app', tab: 'home', budgetItemDetailOpen: null };
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
        finance: { buckets: trial.buckets },
        pendingReviewItems: trial.pendingReviewItems, reviewDecisions: {},
      };
    }
    case 'CLEAR_ALL_DATA': {
      const empty = emptyTrialData();
      return {
        ...state,
        ob: { ...state.ob, manual: { ...state.ob.manual, bankAccounts: empty.manual.bankAccounts, creditCards: empty.manual.creditCards, investments: empty.manual.investments }, subs: empty.subs },
        transactions: empty.transactions,
        finance: { buckets: empty.buckets },
        pendingReviewItems: [], reviewDecisions: {},
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
    case 'SELECT_RECORD_DAY':
      return { ...state, selectedDayMonth: action.month, selectedDay: action.day };
    case 'SET_RECORD_MONTH': {
      // Land on today's day when paging back to the real current month,
      // otherwise the 1st -- never a day number left over from whatever
      // month was viewed before.
      const now = new Date();
      const isCurrent = action.month === SHORT_MONTHS[now.getMonth()] && action.year === now.getFullYear();
      return {
        ...state, recordMonth: action.month, recordYear: action.year,
        selectedDayMonth: action.month, selectedDay: isCurrent ? now.getDate() : 1,
      };
    }
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

    // ---- scan-tax fields (relief impact preview) ----
    case 'TOGGLE_WHY_DEDUCTIBLE':
      return { ...state, showWhyDeductible: !state.showWhyDeductible };
    case 'SET_SCAN_PAYMENT_METHOD':
      return { ...state, scanPaymentMethod: action.value };
    case 'SET_SCAN_TAX_AMOUNT':
      return { ...state, scanTaxAmount: action.value };
    case 'SET_SCAN_TAX_RATE':
      return { ...state, scanTaxRate: action.value };
    case 'SET_SCAN_TAG':
      return { ...state, scanTag: action.value };

    // ---- budgets ----
    case 'TOGGLE_BUCKET':
      return { ...state, expandedBucket: state.expandedBucket === action.key ? null : action.key };
    case 'ADD_BUCKET_CATEGORY': {
      const cat = mkCategory(action.name ?? 'New category', action.cap ?? 0, action.name ? [] : [mkItem('New item', 0)]);
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
      return { ...state, finance: { ...state.finance, buckets: state.finance.buckets.map((b) => b.key !== action.bucketKey ? b : { ...b, categories: b.categories.map((c) => c.id !== action.catId ? c : { ...c, cap: action.value }) }) } };
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
      return { ...state, ob: { ...state.ob, subDraft: nextDraft } };
    }
    case 'ADD_SUBSCRIPTION': {
      const d = state.ob.subDraft;
      if (!d.name || !d.amount) return state;
      return {
        ...state,
        ob: { ...state.ob, subs: [...state.ob.subs, d], subDraft: { name: '', amount: '', frequency: 'Monthly', startDate: '', nextPayment: '', method: 'Cash', category: 'Entertainment' } },
        addSubOpen: false,
      };
    }
    case 'REMOVE_SUBSCRIPTION':
      return { ...state, ob: { ...state.ob, subs: state.ob.subs.filter((_, i) => i !== action.idx) } };
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
      return { ...state, reviewOpen: false };
    case 'ADD_PENDING_REVIEW_ITEMS':
      return { ...state, pendingReviewItems: [...state.pendingReviewItems, ...action.items] };
    case 'SET_STATEMENT_UPLOADING':
      return { ...state, statementUploading: action.value };
    case 'SET_STATEMENT_UPLOAD_ERROR':
      return { ...state, statementUploadError: action.message };
    case 'REVIEW_DECIDE': {
      const pending = reviewPending(state.pendingReviewItems, state.reviewDecisions);
      const item = pending[0];
      if (!item) return state;
      let transactions = state.transactions;
      if (action.dir === 'accept') {
        // Only expenses (negative amount) count toward tax relief — an
        // income/credit line (e.g. a salary deposit) is never deductible,
        // regardless of what categorize() guessed its category as.
        const reliefKey = item.amount < 0 ? categoryToReliefKey(item.cat) ?? undefined : undefined;
        const dateGroup = dateGroupFor(item.dateLabel);
        const tx: Transaction = {
          id: 'rev-' + item.id, merchant: item.merchant, cat: item.cat,
          dateLabel: item.dateLabel, dateGroup, month: monthFromDateLabel(item.dateLabel),
          amount: item.amount, tax: !!reliefKey, brand: item.brand, payment: item.payment, reliefKey,
        };
        transactions = [...state.transactions, tx];
      }
      return { ...state, reviewDecisions: { ...state.reviewDecisions, [item.id]: action.dir }, reviewDragging: false, reviewDragX: 0, transactions };
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
      return { ...state, scanOpen: true, scanStep: 'capture', scanFrom: state.tab, showWhyDeductible: false, scanError: null, ...blankScanFields() };
    case 'CLOSE_SCAN':
      return { ...state, scanOpen: false };
    case 'CHOOSE_MANUAL':
      // True manual entry — fields stay blank, no simulated OCR result.
      return { ...state, scanStep: 'confirm', scanMethod: 'manual' };
    case 'CAPTURE_PHOTO_START':
      return { ...state, scanStep: 'processing', scanError: null };
    case 'CAPTURE_PHOTO_RESULT': {
      const r = action.receipt;
      return {
        ...state, scanStep: 'confirm', scanMethod: 'photo', scanError: null,
        scanMerchant: r.vendor, scanAmount: r.amount ? r.amount.toFixed(2) : '',
        scanDate: isoToDisplayDate(r.date) || state.scanDate,
        scanCategory: mapOcrCategory(r.category),
        scanDeductible: !!r.relief_tag,
      };
    }
    case 'CAPTURE_PHOTO_FAILED':
      // The scanning service couldn't read this photo (or isn't reachable)
      // — fall back to manual entry with blank fields rather than either
      // faking a result or leaving the user stuck on the spinner.
      return { ...state, scanStep: 'confirm', scanMethod: 'manual', scanError: action.message };
    case 'SET_SCAN_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_SCAN_DEDUCTIBLE':
      return { ...state, scanDeductible: action.value };
    case 'SAVE_SCAN': {
      const amount = parseFloat(state.scanAmount) || 0;
      if (!state.scanMerchant || !amount) return { ...state, scanStep: 'saved' };
      const reliefKey = state.scanDeductible ? (categoryToReliefKey(state.scanCategory) ?? undefined) : undefined;
      const tx: Transaction = {
        id: 'scan-' + uid(), merchant: state.scanMerchant, cat: state.scanCategory,
        dateLabel: state.scanDate, dateGroup: dateGroupFor(state.scanDate), month: monthFromDateLabel(state.scanDate),
        amount: -amount, tax: state.scanDeductible, payment: state.scanPaymentMethod, reliefKey,
      };
      return { ...state, scanStep: 'saved', transactions: [...state.transactions, tx] };
    }
    case 'SCAN_ANOTHER':
      return { ...state, scanStep: 'capture', scanError: null, ...blankScanFields() };
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
      return { ...state, aiMessages: [...state.aiMessages, { from: 'user', text: action.text }], aiInput: '', aiTyping: true };
    case 'SUBMIT_AI_TEXT_REPLY':
      return { ...state, aiMessages: [...state.aiMessages, { from: 'ai', text: action.text }], aiTyping: false };

    // ---- accounts ----
    case 'SET_AUTH_USER':
      return { ...state, authUser: action.user };
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
    case 'SET_RESET_TOKEN':
      return { ...state, resetToken: action.token };
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
