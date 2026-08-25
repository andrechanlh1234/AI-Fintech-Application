// Ported from Cukai v7.dc.html state initializer (lines 1967-2021), with
// every pre-filled example value removed — a fresh user starts at RM0 with
// no transactions/subscriptions/accounts until they enter their own.
import { mkInvestRow, defaultNetWorthSeed, defaultBuckets } from '../lib/seedData';
import { blankReceiptDraft } from '../lib/receipts';
import { todayIso, daysAgoIso } from '../lib/format';
import type { AppState } from './types';

const emptySubDraft = {
  name: '', amount: '', frequency: 'Monthly', startDate: '', nextPayment: '', method: 'Cash', category: 'Entertainment',
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = new Date();

export function buildInitialState(): AppState {
  return {
    appStage: 'onboarding',
    obStep: 'login',
    userMode: null,
    ob: {
      name: '', dob: '', country: 'Malaysia', occupation: '', income: '', source: null,
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
    historyMonth: SHORT_MONTHS[today.getMonth()],
    scanPaymentMethod: 'Cash',
    expandedBucket: null,
    expandedTaxGroup: null, taxItemDetailOpen: null, taxReceiptsOpen: false,
    txSearch: '',
    txFilter: 'All',
    confirmedIds: {},
    reviewOpen: false, pendingReviewItems: [], reviewDecisions: {}, reviewDragging: false, reviewDragX: 0, reviewDragStartX: 0,
    statementUploading: false, statementUploadError: null,
    scanOpen: false, scanStep: 'capture', scanFrom: 'home', scanMethod: 'manual',
    receiptDraft: blankReceiptDraft(todayIso()),
    lineItemDrafts: [],
    taxYear: 'YA' + today.getFullYear(),
    mounted: false,
    transactions: [],
    receipts: [],
    txDetailOpen: null,
    txDraft: { merchant: '', cat: 'Food & Drink', amount: '', type: 'expense', date: todayIso(), tax: false, payment: 'Cash' },

    aiView: 'chat', aiMessages: [], aiInput: '', aiTyping: false,
    theme: 'light',
    morePanelOpen: false, notifPanelOpen: false, subscriptionTier: 'free',
    faceIdEnabled: true, taxPackOpen: false,
    statsPeriod: 'This month', statsCategoryDetail: null,
    recordDateFrom: daysAgoIso(29), recordDateTo: todayIso(), historyYear: today.getFullYear(),
    settingsToggles: { budgetAlerts: true, taxReminders: true, weeklySummary: false },
    donateOpen: false, donateDone: false, donateAmount: '10',
    budgetItemDetailOpen: null, addSubOpen: false, taxProfileOpen: false, donutExpanded: false,
    authUser: null, authPanelOpen: false, scanError: null, legalOpen: null, resetToken: null,
    balanceDetailOpen: null, balanceDraft: { mode: 'add', amount: '', desc: '', date: '' },
    historyOpen: null,
    investDetailOpen: null, expandedNwGroup: null,
    netWorthSeed: defaultNetWorthSeed(),
    netWorthHistory: [],
    finance: { buckets: defaultBuckets() },
  };
}

const STORAGE_KEY = 'cukai_v7_data';

// The exact shape synced both to localStorage (always, as an offline cache)
// and to the backend's /state endpoint (only once signed in) — one payload
// shape for both, so a signed-in user's data round-trips identically
// whichever store it came from.
// The onboarding answers that drive tax-relief eligibility (marital status,
// dependants, disability, housing loan, self-reported relief categories,
// income) and profile display (name, DOB, residency, employment) -- these
// used to live only in in-memory ob state and were silently dropped on
// every reload/re-login, which made the Tax Center under-report relief
// categories the user actually qualifies for (see TAX_RELEVANCE_RULES in
// lib/taxEngine.ts) and reset the Settings profile card back to the seed
// "Aina Natasha" placeholder.
export interface SyncProfile {
  name: AppState['ob']['name'];
  dob: AppState['ob']['dob'];
  country: AppState['ob']['country'];
  occupation: AppState['ob']['occupation'];
  income: AppState['ob']['income'];
  residency: AppState['ob']['residency'];
  marital: AppState['ob']['marital'];
  dependants: AppState['ob']['dependants'];
  employment: AppState['ob']['employment'];
  employer: AppState['ob']['employer'];
  hasDisability: AppState['ob']['hasDisability'];
  hasHousingLoan: AppState['ob']['hasHousingLoan'];
  approxIncome: AppState['ob']['approxIncome'];
  multipleIncome: AppState['ob']['multipleIncome'];
  incomeTypes: AppState['ob']['incomeTypes'];
  reliefs: AppState['ob']['reliefs'];
  goals: AppState['ob']['goals'];
  savingsTarget: AppState['ob']['savingsTarget'];
}

export interface SyncPayload {
  manual: AppState['ob']['manual'];
  subs: AppState['ob']['subs'];
  profile: SyncProfile;
  buckets: AppState['finance']['buckets'];
  obDone: boolean;
  theme: AppState['theme'];
  netWorthSeed: AppState['netWorthSeed'];
  transactions: AppState['transactions'];
  receipts: AppState['receipts'];
  netWorthHistory: AppState['netWorthHistory'];
  userMode: AppState['userMode'];
  pendingReviewItems: AppState['pendingReviewItems'];
  reviewDecisions: AppState['reviewDecisions'];
}

export function buildSyncPayload(state: AppState): SyncPayload {
  return {
    manual: state.ob.manual,
    subs: state.ob.subs,
    profile: {
      name: state.ob.name, dob: state.ob.dob, country: state.ob.country, occupation: state.ob.occupation,
      income: state.ob.income, residency: state.ob.residency, marital: state.ob.marital, dependants: state.ob.dependants,
      employment: state.ob.employment, employer: state.ob.employer, hasDisability: state.ob.hasDisability,
      hasHousingLoan: state.ob.hasHousingLoan, approxIncome: state.ob.approxIncome, multipleIncome: state.ob.multipleIncome,
      incomeTypes: state.ob.incomeTypes, reliefs: state.ob.reliefs, goals: state.ob.goals, savingsTarget: state.ob.savingsTarget,
    },
    buckets: state.finance.buckets,
    obDone: state.appStage === 'app',
    theme: state.theme,
    netWorthSeed: state.netWorthSeed,
    transactions: state.transactions,
    receipts: state.receipts,
    netWorthHistory: state.netWorthHistory,
    userMode: state.userMode,
    pendingReviewItems: state.pendingReviewItems,
    reviewDecisions: state.reviewDecisions,
  };
}

export function applySyncPayload(base: AppState, p: Partial<SyncPayload>): AppState {
  const next = { ...base };
  if (p.manual) next.ob = { ...next.ob, manual: { ...next.ob.manual, ...p.manual } };
  if (p.subs) next.ob = { ...next.ob, subs: p.subs };
  if (p.profile) next.ob = { ...next.ob, ...p.profile };
  if (p.buckets) next.finance = { ...next.finance, buckets: p.buckets };
  if (p.obDone) next.appStage = 'app';
  if (p.theme) next.theme = p.theme;
  if (p.transactions) next.transactions = p.transactions;
  if (p.receipts) next.receipts = p.receipts;
  if (p.netWorthSeed) next.netWorthSeed = p.netWorthSeed;
  if (p.netWorthHistory) next.netWorthHistory = p.netWorthHistory;
  if (p.userMode) next.userMode = p.userMode;
  if (p.pendingReviewItems) next.pendingReviewItems = p.pendingReviewItems;
  if (p.reviewDecisions) next.reviewDecisions = p.reviewDecisions;
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
