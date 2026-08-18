// State shape ported from Cukai v7.dc.html (lines 1967-2021).
import type { RecordRow, InvestRow, NetWorthSeed, Bucket, AiMessage, BalanceEntry } from '../lib/seedData';

export interface Subscription {
  name: string;
  amount: string;
  frequency: string;
  startDate: string;
  nextPayment: string;
  method: string;
  category: string;
}

export interface ManualData {
  bankAccounts: RecordRow[];
  creditCards: RecordRow[];
  properties: RecordRow[];
  otherAssets: RecordRow[];
  liabilities: RecordRow[];
  investments: InvestRow[];
}

export interface OnboardingState {
  name: string;
  age: string;
  country: string;
  occupation: string;
  income: string;
  source: string | null;
  residency: string | null;
  marital: string | null;
  dependants: string | null;
  employment: string | null;
  employer: string;
  hasDisability: string | null;
  hasHousingLoan: string | null;
  approxIncome: string;
  multipleIncome: string | null;
  incomeTypes: string[];
  reliefs: string[];
  otherText: Record<string, string>;
  agreedTerms: boolean;
  setupMethod: 'link' | 'manual' | null;
  linkedIds: string[];
  connectingId: string | null;
  manual: ManualData;
  subs: Subscription[];
  subDraft: Subscription;
  goals: string[];
  savingsTarget: string;
}

export interface BalanceDraft {
  mode: 'add' | 'deduct';
  amount: string;
  desc: string;
  date: string;
}

export type FinanceSection = 'networth' | 'record' | 'budgets' | 'stats' | 'history';
export type Tab = 'home' | 'finance' | 'tax' | 'ai';
export type ScanStep = 'capture' | 'processing' | 'confirm' | 'saved';

export interface AppState {
  appStage: 'onboarding' | 'app';
  obStep: string;
  ob: OnboardingState;

  tab: Tab;
  financeSection: FinanceSection;
  netWorthRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';
  nwSelectedIdx: number | null;
  historyMonth: string;
  showWhyDeductible: boolean;
  scanTaxAmount: string;
  scanTaxRate: string;
  scanPaymentMethod: string;
  scanTag: string;
  expandedBucket: string | null;
  expandedTaxGroup: string | null;
  taxItemDetailOpen: string | null;
  showAllTaxReceipts: boolean;
  txSearch: string;
  txFilter: string;
  confirmedIds: Record<string, boolean>;
  reviewOpen: boolean;
  reviewDecisions: Record<string, 'accept' | 'reject'>;
  reviewDragging: boolean;
  reviewDragX: number;
  reviewDragStartX: number;
  scanOpen: boolean;
  scanStep: ScanStep;
  scanFrom: Tab;
  scanMerchant: string;
  scanAmount: string;
  scanDate: string;
  scanCategory: string;
  scanDeductible: boolean;
  taxYear: 'YA2026' | 'YA2025';
  mounted: boolean;

  aiView: 'chat' | 'history';
  aiMessages: AiMessage[];
  aiInput: string;
  aiTyping: boolean;
  theme: 'light' | 'dark';
  morePanelOpen: boolean;
  notifPanelOpen: boolean;
  subscriptionTier: 'free' | 'premium';
  faceIdEnabled: boolean;
  taxPackOpen: boolean;
  selectedDayMonth: string;
  selectedDay: number;
  statsPeriod: string;
  statsCategoryDetail: string | null;
  settingsToggles: { budgetAlerts: boolean; taxReminders: boolean; weeklySummary: boolean };
  donateOpen: boolean;
  donateDone: boolean;
  donateAmount: string;
  budgetItemDetailOpen: string | null;
  addSubOpen: boolean;
  donutExpanded: boolean;
  balanceDetailOpen: string | null;
  balanceDraft: BalanceDraft;
  investDetailOpen: string | null;
  expandedNwGroup: string | null;
  netWorthSeed: NetWorthSeed;
  finance: { buckets: Bucket[] };
}

export type { BalanceEntry };
