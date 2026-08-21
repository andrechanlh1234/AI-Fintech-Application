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
    { key: 'insurance', name: 'Insurance', categories: [] },
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

export const NOTIFICATIONS: NotifItem[] = [
  { kind: 'tax', title: 'Lifestyle relief 87% used', sub: 'RM 320 of your RM 2,500 cap left this year', time: '2h ago' },
  { kind: 'mail', title: 'Invoice detected from Gmail', sub: 'Astro Invoice — RM 240.00 ready to review', time: '5h ago' },
  { kind: 'check', title: 'Popular Bookstore tagged deductible', sub: 'Added to your Lifestyle relief automatically', time: 'Yesterday' },
  { kind: 'trend', title: 'Net worth up 4.2% this month', sub: 'Driven mostly by your investment accounts', time: '2 days ago' },
  { kind: 'budget', title: 'Dining budget 90% used', sub: 'RM 45 left in your Dining category this month', time: '3 days ago' },
];

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

export function aiCraftReply(q: string): string {
  const s = q.toLowerCase();
  if (s.includes('tax') || s.includes('relief')) return "Based on your YA2026 profile, you've captured about 62% of your available reliefs — Lifestyle and EPF & Insurance still have room. Want me to show which receipts could help?";
  if (s.includes('budget') || s.includes('spend')) return "You've spent RM 6,960 of your RM 8,500 budget this month — about RM 540 left with a week to go. Dining is your fastest-growing category.";
  if (s.includes('net worth') || s.includes('save') || s.includes('invest')) return 'Your net worth is trending up over the last 12 months, mostly from investment growth outpacing new liabilities. Want a full breakdown?';
  return "I looked across your linked accounts, receipts and tax profile — your spending is on pace and two receipts from this week look tax-deductible. Ask me about a specific account, category, or relief for more detail.";
}
