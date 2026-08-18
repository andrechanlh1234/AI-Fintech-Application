// Ported from Cukai v7.dc.html state initializer (lines 1967-2021).
import { mkRecord, mkInvestRow, defaultNetWorthSeed, defaultBuckets } from '../lib/seedData';
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
        bankAccounts: [mkRecord('UOB One', '5000'), mkRecord('Maybank Savings', '10000'), mkRecord('CIMB', '3000')],
        creditCards: [mkRecord('UOB One Card', '2000'), mkRecord('HSBC Live+', '1500'), mkRecord('Maybank Visa', '800')],
        properties: [mkRecord('Property 1', '800000'), mkRecord('Property 2', '500000')],
        otherAssets: [mkRecord('Car', '80000'), mkRecord('Gold', '20000'), mkRecord('Investments', '50000')],
        liabilities: [mkRecord('Personal Loan', '30000'), mkRecord('Student Loan', '15000')],
        investments: [mkInvestRow('', '', '', ''), mkInvestRow('', '', '', ''), mkInvestRow('', '', '', '')],
      },
      subs: [
        { name: 'Netflix', amount: '55', frequency: 'Monthly', startDate: '15 Jan 2026', nextPayment: '15 Aug 2026', method: 'Maybank Visa', category: 'Entertainment' },
        { name: 'Spotify', amount: '15.90', frequency: 'Monthly', startDate: '20 Feb 2026', nextPayment: '20 Aug 2026', method: "Touch 'n Go eWallet", category: 'Entertainment' },
      ],
      subDraft: { ...emptySubDraft },
      goals: [], savingsTarget: '',
    },

    tab: 'home',
    financeSection: 'networth',
    netWorthRange: '1Y',
    nwSelectedIdx: null,
    historyMonth: 'Aug',
    showWhyDeductible: false,
    scanTaxAmount: '0.70', scanTaxRate: '6', scanPaymentMethod: 'Maybank Visa', scanTag: '',
    expandedBucket: null,
    expandedTaxGroup: null, taxItemDetailOpen: null, showAllTaxReceipts: false,
    txSearch: '',
    txFilter: 'All',
    confirmedIds: {},
    reviewOpen: false, reviewDecisions: {}, reviewDragging: false, reviewDragX: 0, reviewDragStartX: 0,
    scanOpen: false, scanStep: 'capture', scanFrom: 'home',
    scanMerchant: 'Popular Bookstore', scanAmount: '86.00', scanDate: '9 Aug 2026',
    scanCategory: 'Lifestyle', scanDeductible: true,
    taxYear: 'YA2026',
    mounted: false,

    aiView: 'chat', aiMessages: [], aiInput: '', aiTyping: false,
    theme: 'light',
    morePanelOpen: false, notifPanelOpen: false, subscriptionTier: 'free',
    faceIdEnabled: true, taxPackOpen: false,
    selectedDayMonth: 'Aug', selectedDay: 15, statsPeriod: 'This month', statsCategoryDetail: null,
    settingsToggles: { budgetAlerts: true, taxReminders: true, weeklySummary: false },
    donateOpen: false, donateDone: false, donateAmount: '10',
    budgetItemDetailOpen: null, addSubOpen: false, donutExpanded: false,
    balanceDetailOpen: null, balanceDraft: { mode: 'add', amount: '', desc: '', date: '' },
    investDetailOpen: null, expandedNwGroup: null,
    netWorthSeed: defaultNetWorthSeed(),
    finance: { buckets: defaultBuckets() },
  };
}

const STORAGE_KEY = 'cukai_v7_data';

export function loadPersisted(): Partial<{
  manual: AppState['ob']['manual'];
  buckets: AppState['finance']['buckets'];
  obDone: boolean;
  theme: AppState['theme'];
  netWorthSeed: AppState['netWorthSeed'];
}> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      manual: state.ob.manual,
      buckets: state.finance.buckets,
      obDone: state.appStage === 'app',
      theme: state.theme,
      netWorthSeed: state.netWorthSeed,
    }));
  } catch {
    // ignore write failures (private browsing / storage full)
  }
}

export function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function mergePersisted(base: AppState): AppState {
  const p = loadPersisted();
  if (!p) return base;
  if (p.manual) base.ob.manual = { ...base.ob.manual, ...p.manual };
  if (p.buckets) base.finance.buckets = p.buckets;
  if (p.obDone) base.appStage = 'app';
  if (p.theme) base.theme = p.theme;
  if (p.netWorthSeed) base.netWorthSeed = p.netWorthSeed;
  return base;
}
