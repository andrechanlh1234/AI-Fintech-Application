// Ported from Cukai v7.dc.html state initializer (lines 1967-2021), with
// every pre-filled example value removed — a fresh user starts at RM0 with
// no transactions/subscriptions/accounts until they enter their own.
import { mkInvestRow, defaultNetWorthSeed, defaultBuckets } from '../lib/seedData';
import type { AppState } from './types';

const emptySubDraft = {
  name: '', amount: '', frequency: 'Monthly', startDate: '', nextPayment: '', method: 'Maybank Visa', category: 'Entertainment',
};

export function buildInitialState(): AppState {
  return {
    appStage: 'onboarding',
    obStep: 'login',
    ob: {
      name: '', age: '', country: 'Malaysia', occupation: '', income: '', source: null,
      residency: null, marital: null, dependants: null, employment: null, employer: '',
      hasDisability: null, hasHousingLoan: null,
      approxIncome: '', multipleIncome: null, incomeTypes: [], reliefs: [], otherText: {}, agreedTerms: false,
      setupMethod: null, linkedIds: [], connectingId: null,
      manual: {
        bankAccounts: [],
        creditCards: [],
        properties: [],
        otherAssets: [],
        liabilities: [],
        investments: [mkInvestRow('', '', '', ''), mkInvestRow('', '', '', ''), mkInvestRow('', '', '', '')],
      },
      subs: [],
      subDraft: { ...emptySubDraft },
      goals: [], savingsTarget: '',
    },

    tab: 'home',
    financeSection: 'networth',
    netWorthRange: '1Y',
    nwSelectedIdx: null,
    historyMonth: 'Aug',
    showWhyDeductible: false,
    scanTaxAmount: '', scanTaxRate: '6', scanPaymentMethod: 'Maybank Visa', scanTag: '',
    expandedBucket: null,
    expandedTaxGroup: null, taxItemDetailOpen: null, showAllTaxReceipts: false,
    txSearch: '',
    txFilter: 'All',
    confirmedIds: {},
    reviewOpen: false, reviewDecisions: {}, reviewDragging: false, reviewDragX: 0, reviewDragStartX: 0,
    scanOpen: false, scanStep: 'capture', scanFrom: 'home', scanMethod: 'manual',
    // Blank until the user fills them in (manual entry) or capturePhoto's
    // simulated-OCR result fills them in (see CAPTURE_PHOTO_DONE in reducer.ts).
    scanMerchant: '', scanAmount: '', scanDate: '15 Aug 2026',
    scanCategory: 'Food & Drink', scanDeductible: false,
    taxYear: 'YA2026',
    mounted: false,
    transactions: [],

    aiView: 'chat', aiMessages: [], aiInput: '', aiTyping: false,
    theme: 'light',
    morePanelOpen: false, notifPanelOpen: false, subscriptionTier: 'free',
    faceIdEnabled: true, taxPackOpen: false,
    selectedDayMonth: 'Aug', selectedDay: 15, statsPeriod: 'This month', statsCategoryDetail: null,
    settingsToggles: { budgetAlerts: true, taxReminders: true, weeklySummary: false },
    donateOpen: false, donateDone: false, donateAmount: '10',
    budgetItemDetailOpen: null, addSubOpen: false, donutExpanded: false,
    authUser: null, authPanelOpen: false, scanError: null, legalOpen: null, resetToken: null,
    balanceDetailOpen: null, balanceDraft: { mode: 'add', amount: '', desc: '', date: '' },
    investDetailOpen: null, expandedNwGroup: null,
    netWorthSeed: defaultNetWorthSeed(),
    finance: { buckets: defaultBuckets() },
  };
}

const STORAGE_KEY = 'cukai_v7_data';

// The exact shape synced both to localStorage (always, as an offline cache)
// and to the backend's /state endpoint (only once signed in) — one payload
// shape for both, so a signed-in user's data round-trips identically
// whichever store it came from.
export interface SyncPayload {
  manual: AppState['ob']['manual'];
  subs: AppState['ob']['subs'];
  buckets: AppState['finance']['buckets'];
  obDone: boolean;
  theme: AppState['theme'];
  netWorthSeed: AppState['netWorthSeed'];
  transactions: AppState['transactions'];
}

export function buildSyncPayload(state: AppState): SyncPayload {
  return {
    manual: state.ob.manual,
    subs: state.ob.subs,
    buckets: state.finance.buckets,
    obDone: state.appStage === 'app',
    theme: state.theme,
    netWorthSeed: state.netWorthSeed,
    transactions: state.transactions,
  };
}

export function applySyncPayload(base: AppState, p: Partial<SyncPayload>): AppState {
  const next = { ...base };
  if (p.manual) next.ob = { ...next.ob, manual: { ...next.ob.manual, ...p.manual } };
  if (p.subs) next.ob = { ...next.ob, subs: p.subs };
  if (p.buckets) next.finance = { ...next.finance, buckets: p.buckets };
  if (p.obDone) next.appStage = 'app';
  if (p.theme) next.theme = p.theme;
  if (p.transactions) next.transactions = p.transactions;
  if (p.netWorthSeed) next.netWorthSeed = p.netWorthSeed;
  return next;
}

export function loadPersisted(): Partial<SyncPayload> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSyncPayload(state)));
  } catch {
    // ignore write failures (private browsing / storage full)
  }
}

export function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function mergePersisted(base: AppState): AppState {
  const p = loadPersisted();
  return p ? applySyncPayload(base, p) : base;
}
