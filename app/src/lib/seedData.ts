// Ported verbatim from Cukai v7.dc.html (lines 1661-1714, 1903-1957, 1943-1947).
import { uid } from './ids';

export interface Transaction {
  id: number | string;
  merchant: string;
  cat: string;
  dateLabel: string;
  dateGroup: string;
  month: string;
  amount: number;
  tax: boolean;
  brand?: string;
  payment: string;
  /** LHDN relief item key (see lib/taxEngine.ts TAX_ITEMS_META) this
   * transaction counts toward, when tax=true. Set by the scan/review flows
   * via categoryToReliefKey(); undefined means "deductible but uncategorised". */
  reliefKey?: string;
  /** Id of the Receipt (lib/receipts.ts) this transaction was generated
   * from, when it came from a receipt scan or manual receipt entry --
   * undefined for a transaction with no receipt behind it. The receipt
   * itself is display-only; editing/deleting this transaction never
   * touches the receipt record (see lib/receipts.ts's Receipt doc comment). */
  receiptId?: string;
}

export interface BalanceEntry { id: string; amount: number; desc: string; date: string }
/** `date` (ISO, YYYY-MM-DD) is the "as of" date for `amount` on a manually-
 * edited row (Finance > Net worth) — it's what lets the net-worth chart plot
 * a balance change on the date it actually happened instead of always
 * "today". Defaults to today via mkRecord(); absent on rows ported from
 * before this existed, which computeNetWorthTimeline treats as "today". */
export interface RecordRow { id: string; name: string; amount: string; date?: string; history?: BalanceEntry[] }
export interface SeedRow extends RecordRow { brand: string | null }
export interface InvestRow { id: string; name: string; qty: string; buy: string; cur: string; brand?: string | null }

export function mkRecord(name: string, amount: string, date?: string): RecordRow {
  return { id: uid(), name, amount, date, history: [] };
}
export function mkInvestRow(name: string, qty: string, buy: string, cur: string): InvestRow {
  return { id: uid(), name, qty, buy, cur };
}
export function mkSeedCash(name: string, balance: number, brand: string | null): SeedRow {
  return { id: uid(), name, amount: String(balance), brand: brand || null, history: [] };
}
export function mkSeedInvest(name: string, balance: number, brand: string | null): InvestRow {
  return { id: uid(), name, qty: '1', buy: String(balance), cur: String(balance), brand: brand || null };
}

export interface NetWorthSeed {
  cash: SeedRow[];
  investments: InvestRow[];
  creditCards: SeedRow[];
}

// No pre-filled "connected" accounts — a fresh user has RM0 until they add
// a manual entry or (once a real bank integration exists) actually link an
// account. mkSeedCash/mkSeedInvest stay exported for that future wiring.
export function defaultNetWorthSeed(): NetWorthSeed {
  return { cash: [], investments: [], creditCards: [] };
}

export interface BudgetItem { id: string; name: string; amount: number | string }
export interface BudgetCategory { id: string; name: string; cap: number; items: BudgetItem[] }
export interface Bucket { key: string; name: string; categories: BudgetCategory[] }

export function mkItem(name: string, amount: number): BudgetItem {
  return { id: uid(), name, amount };
}
export function mkCategory(name: string, cap: number, items: BudgetItem[]): BudgetCategory {
  return { id: uid(), name, cap, items };
}

// The four bucket groups are real structure from the source design (Fixed/
// Flexible/Goals/Insurance), but no pre-filled categories or amounts — the
// user builds their own budget via "Add category" / "Add item".
export function defaultBuckets(): Bucket[] {
  return [
    { key: 'fixed', name: 'Fixed', categories: [] },
    { key: 'flexible', name: 'Flexible', categories: [] },
    { key: 'goals', name: 'Goals', categories: [] },
  ];
}

export const MONTH_SUMMARIES: Record<string, { income: number; expenses: number }> = {
  Jan: { income: 9200, expenses: 6800 }, Feb: { income: 9200, expenses: 6100 }, Mar: { income: 9500, expenses: 7200 },
  Apr: { income: 9500, expenses: 6400 }, May: { income: 9800, expenses: 6900 }, Jun: { income: 9800, expenses: 6300 },
  Jul: { income: 9800, expenses: 6960 }, Aug: { income: 9800, expenses: 6960 },
};

/** A pending, not-yet-accepted transaction awaiting the user's swipe
 * decision — populated for real from an uploaded receipt/statement
 * (state.pendingReviewItems, see StoreProvider's uploadStatement action),
 * never from a fixed sample list. `amount` is signed, same convention as
 * Transaction.amount: negative = expense, positive = income/credit — a
 * statement can contain both (e.g. a salary deposit alongside spending). */
export interface ReviewItem { id: string; merchant: string; amount: number; cat: string; dateLabel: string; brand: string; payment: string }

export interface NotifItem { kind: string; title: string; sub: string; time: string }

// No fabricated notifications. The previous fixed sample list rendered for
// every user regardless of state — a brand-new RM 0 account still saw "RM 45
// left in your Dining category", "Net worth up 4.2%", etc. as if they were
// its own data, and the bell always showed an unread dot. There is no real
// event pipeline yet, so the honest default is an empty list + an empty
// state (see NotifPanel). Re-populate this from real state when there is one.
export const NOTIFICATIONS: NotifItem[] = [];

export function notifIconFlags(kind: string) {
  const flags: Record<string, boolean> = { isTax: false, isMail: false, isTrend: false, isCheck: false, isBudget: false };
  const key = 'is' + kind.charAt(0).toUpperCase() + kind.slice(1);
  if (key in flags) flags[key] = true;
  const bgMap: Record<string, string> = { tax: 'var(--color-tax-100)', mail: 'var(--color-neutral-200)', trend: 'var(--color-accent-100)', check: 'var(--color-accent-100)', budget: 'var(--color-accent-100)' };
  const colorMap: Record<string, string> = { tax: 'var(--color-tax-700)', mail: 'var(--color-text-muted)', trend: 'var(--color-accent-700)', check: 'var(--color-accent-700)', budget: 'var(--color-accent-700)' };
  return { ...flags, bg: bgMap[kind], color: colorMap[kind] };
}

export interface AiMessage { from: 'user' | 'ai'; text: string }
export interface AiHistoryItem { id: string; title: string; date: string; preview: string; messages: AiMessage[] }

export const AI_CHAT_HISTORY: AiHistoryItem[] = [
  { id: 'c1', title: 'Lifestyle relief room left', date: '6 Aug', preview: "You've used RM 2,180 of your RM 2,500 Lifestyle cap...", messages: [
    { from: 'user', text: 'How much Lifestyle relief do I have left?' },
    { from: 'ai', text: "You've captured RM 2,180 of your RM 2,500 Lifestyle cap this year — RM 320 remaining. Your Popular Bookstore receipt from this week already counts toward it." },
  ] },
  { id: 'c2', title: 'Am I on track this month?', date: '2 Aug', preview: "You're RM 540 under budget with a week left...", messages: [
    { from: 'user', text: 'Am I on track with my budget this month?' },
    { from: 'ai', text: "You're RM 540 under your RM 8,500 monthly budget with about a week left. Dining is your fastest-growing category — worth a look if you want to stay ahead." },
  ] },
  { id: 'c3', title: 'Net worth trend', date: '28 Jul', preview: 'Your net worth is up over the last 12 months...', messages: [
    { from: 'user', text: "What's my net worth trend look like?" },
    { from: 'ai', text: 'Your net worth has trended upward over the last 12 months, driven mainly by growth in your investment accounts outpacing new liabilities. Want the assets vs liabilities breakdown?' },
  ] },
];

// Offline fallback used only when the Gemini backend can't be reached (no
// network, backend down, or the call errored). It must NOT invent figures —
// a wrong specific ringgit amount in a finance app is worse than no answer —
// so it points the user at the screen that has their real, live numbers
// instead of quoting made-up ones.
export function aiCraftReply(q: string): string {
  const s = q.toLowerCase();
  if (s.includes('tax') || s.includes('relief'))
    return "I can't reach the assistant right now, so I can't read your live relief figures. Open the Tax Center — it shows, per relief group, how much you've captured and how much room is left. Lifestyle and EPF & Insurance are usually the ones with headroom.";
  if (s.includes('budget') || s.includes('spend'))
    return "I can't reach the assistant right now to pull your live numbers. Your Home screen and the Budgets tab show this month's spend against each category's cap — anything close to or over its limit is worth a look.";
  if (s.includes('net worth') || s.includes('save') || s.includes('invest'))
    return "I can't reach the assistant right now. Finance › Net worth has your current figure, the trend over time, and the assets-vs-liabilities breakdown.";
  return "I can't reach the assistant right now — check your connection and try again. In the meantime, the Home, Finance and Tax Center screens all show your up-to-date numbers.";
}
