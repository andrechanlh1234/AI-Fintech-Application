// State shape ported from Cukai v7.dc.html (lines 1967-2021).
import type { RecordRow, InvestRow, NetWorthSeed, Bucket, AiMessage, BalanceEntry, Transaction, ReviewItem } from '../lib/seedData';
import type { Receipt, ReceiptDraft, ReceiptLineItemDraft } from '../lib/receipts';

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
  /** ISO date (YYYY-MM-DD) from a real <input type="date"> — display age is
   * derived from this via computeAge() in lib/format.ts, never stored as a
   * separately-editable number (it would silently go stale). */
  dob: string;
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

export interface TxDraft {
  merchant: string;
  cat: string;
  amount: string;
  type: 'expense' | 'income';
  /** ISO (YYYY-MM-DD) -- what <input type="date"> reads and writes. */
  date: string;
  tax: boolean;
  payment: string;
}

/** One learned merchant, keyed by normalizeMerchant(merchant) in
 * merchantMemory. Every field except confirmedCount is optional so a
 * partially-known merchant (e.g. only its category was ever confirmed)
 * still round-trips. */
export interface MerchantMemoryEntry {
  category?: string;
  name?: string;
  payment?: string;
  taxDeductible?: boolean;
  confirmedCount: number;
}
export type MerchantMemory = Record<string, MerchantMemoryEntry>;

export type FinanceSection = 'networth' | 'record' | 'budgets' | 'stats' | 'history';
export type Tab = 'home' | 'finance' | 'tax' | 'ai';
export type ScanStep = 'capture' | 'preview' | 'processing' | 'unable' | 'review' | 'saved';

export interface AppState {
  appStage: 'onboarding' | 'app';
  obStep: string;
  ob: OnboardingState;
  /** null until the very first "are you a developer or a customer?" choice
   * is made, before onboarding proper even starts. Gates onboarding's Skip
   * link (developer-only) and is changeable later via a More panel toggle. */
  userMode: 'developer' | 'customer' | null;

  tab: Tab;
  financeSection: FinanceSection;
  netWorthRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';
  nwSelectedIdx: number | null;
  historyMonth: string;
  scanPaymentMethod: string;
  expandedBucket: string | null;
  expandedTaxGroup: string | null;
  taxItemDetailOpen: string | null;
  taxReceiptsOpen: boolean;
  txSearch: string;
  txFilter: string;
  confirmedIds: Record<string, boolean>;
  reviewOpen: boolean;
  /** Real pending items from an uploaded receipt/statement, awaiting an
   * accept/reject swipe — see lib/seedData.ts's ReviewItem doc comment. */
  pendingReviewItems: ReviewItem[];
  reviewDecisions: Record<string, 'accept' | 'reject'>;
  statementUploading: boolean;
  statementUploadError: string | null;
  /** Per-account merchant learning — see lib/merchantMemory.ts. Persisted
   * locally and synced to the account (buildSyncPayload / mergePersisted). */
  merchantMemory: MerchantMemory;
  /** Transaction ids committed automatically from merchantMemory during the
   * import currently being reviewed (confirmedCount >= 2 merchants). Drives
   * ReviewFlow's "N added automatically" banner; the Undo button rolls them
   * back. Cleared on CLOSE_REVIEW; deliberately NOT synced. */
  autoAddedThisImport: string[];
  reviewDragging: boolean;
  reviewDragX: number;
  reviewDragStartX: number;
  scanOpen: boolean;
  scanStep: ScanStep;
  scanFrom: Tab;
  /** Whether the confirm step's fields came from the simulated-photo path
   * (capturePhoto) or true manual entry (chooseManual) — drives whether the
   * "read from your photo" badge is honest to show. */
  scanMethod: 'photo' | 'manual';
  receiptDraft: ReceiptDraft;
  lineItemDrafts: ReceiptLineItemDraft[];
  /** "YA" + assessment year, e.g. "YA2026". A plain string, not a fixed
   * union, so future years become selectable without a type change --
   * see YearPicker in TaxCenter. */
  taxYear: string;
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
  recordDateFrom: string;
  recordDateTo: string;
  statsPeriod: string;
  statsCategoryDetail: string | null;
  historyYear: number;
  settingsToggles: { budgetAlerts: boolean; taxReminders: boolean; weeklySummary: boolean };
  donateOpen: boolean;
  donateDone: boolean;
  donateAmount: string;
  budgetItemDetailOpen: string | null;
  addSubOpen: boolean;
  taxProfileOpen: boolean;
  authUser: { id: string; email: string } | null;
  authPanelOpen: boolean;
  scanError: string | null;
  legalOpen: 'privacy' | 'terms' | null;
  donutExpanded: boolean;
  balanceDetailOpen: string | null;
  balanceDraft: BalanceDraft;
  historyOpen: string | null;
  investDetailOpen: string | null;
  expandedNwGroup: string | null;
  netWorthSeed: NetWorthSeed;
  /** Real net-worth snapshots, one upserted per calendar day whenever net
   * worth actually changes (see StoreProvider's snapshot effect) — this is
   * what makes the Finance > Net worth chart a real line instead of a flat
   * repeat of the current value. A fresh account has at most one entry;
   * the chart only shows real movement once real days of usage exist. */
  netWorthHistory: { date: string; value: number }[];
  finance: { buckets: Bucket[] };
  /** Real transactions the user has added — via a saved scan or an accepted
   * review-import item. Starts empty; nothing here unless the user put it
   * there. Budget line items and REVIEW_ITEMS are derived/overlaid on top
   * of this in selectors, not stored here. */
  transactions: Transaction[];
  /** Parent receipt records -- see lib/receipts.ts's Receipt doc comment.
   * A receipt's own total/line-item-total never changes after save; the
   * transactions it produced (state.transactions, matched by receiptId)
   * are what the user actually edits/deletes afterward. */
  receipts: Receipt[];
  /** Id of the transaction currently open in the edit/delete detail sheet
   * (Record page row tap), or null when closed. */
  txDetailOpen: string | number | null;
  txDraft: TxDraft;
}

export type { BalanceEntry };
