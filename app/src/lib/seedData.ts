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
}

export const ALL_TX: Transaction[] = [
  { id: 1, merchant: 'Grab', cat: 'Transport', dateLabel: 'Today, 8:12 AM', dateGroup: 'Today', month: 'Aug', amount: -18.5, tax: false, brand: 'grab', payment: 'GrabPay' },
  { id: 2, merchant: 'Tealive', cat: 'Food & Drink', dateLabel: 'Today, 7:35 AM', dateGroup: 'Today', month: 'Aug', amount: -9.9, tax: false, brand: 'tealive', payment: 'Maybank Visa' },
  { id: 3, merchant: 'Popular Bookstore', cat: 'Lifestyle', dateLabel: 'Yesterday', dateGroup: 'Yesterday', month: 'Aug', amount: -86.0, tax: true, payment: 'CIMB Credit Card' },
  { id: 4, merchant: 'Guardian Pharmacy', cat: 'Health', dateLabel: 'Yesterday', dateGroup: 'Yesterday', month: 'Aug', amount: -43.2, tax: true, brand: 'guardian', payment: "Touch 'n Go eWallet" },
  { id: 5, merchant: 'Shopee', cat: 'Shopping', dateLabel: 'Yesterday', dateGroup: 'Yesterday', month: 'Aug', amount: -129.0, tax: false, brand: 'shopee', payment: 'CIMB Credit Card' },
  { id: 6, merchant: 'TNB', cat: 'Bills', dateLabel: 'Mon', dateGroup: 'This week', month: 'Aug', amount: -142.3, tax: false, payment: 'Maybank Savings' },
  { id: 7, merchant: 'Astro', cat: 'Bills', dateLabel: 'Mon', dateGroup: 'This week', month: 'Aug', amount: -99.9, tax: false, payment: 'Maybank Savings' },
  { id: 8, merchant: 'Salary', cat: 'Income', dateLabel: '1 Aug', dateGroup: 'This week', month: 'Aug', amount: 6200.0, tax: false, payment: 'Bank Transfer' },
  { id: 9, merchant: 'Grab', cat: 'Transport', dateLabel: 'Sun', dateGroup: 'This week', month: 'Aug', amount: -24.0, tax: false, brand: 'grab', payment: 'GrabPay' },
  { id: 10, merchant: 'Mr DIY', cat: 'Shopping', dateLabel: '28 Jul', dateGroup: 'Earlier', month: 'Jul', amount: -35.5, tax: false, payment: "Touch 'n Go eWallet" },
  { id: 11, merchant: 'Klinik Mediviron', cat: 'Health', dateLabel: '26 Jul', dateGroup: 'Earlier', month: 'Jul', amount: -120.0, tax: true, payment: 'Cash' },
  { id: 12, merchant: "Touch 'n Go Reload", cat: 'Transport', dateLabel: '24 Jul', dateGroup: 'Earlier', month: 'Jul', amount: -50.0, tax: false, payment: 'Maybank Visa' },
];

export interface BalanceEntry { id: string; amount: number; desc: string; date: string }
export interface RecordRow { id: string; name: string; amount: string; history?: BalanceEntry[] }
export interface SeedRow extends RecordRow { brand: string | null }
export interface InvestRow { id: string; name: string; qty: string; buy: string; cur: string; brand?: string | null }

export function mkRecord(name: string, amount: string): RecordRow {
  return { id: uid(), name, amount, history: [] };
}
export function mkInvestRow(name: string, qty: string, buy: string, cur: string): InvestRow {
  return { id: uid(), name, qty, buy, cur };
}
function mkSeedCash(name: string, balance: number, brand: string | null): SeedRow {
  return { id: uid(), name, amount: String(balance), brand: brand || null, history: [] };
}
function mkSeedInvest(name: string, balance: number, brand: string | null): InvestRow {
  return { id: uid(), name, qty: '1', buy: String(balance), cur: String(balance), brand: brand || null };
}

export interface NetWorthSeed {
  cash: SeedRow[];
  investments: InvestRow[];
  creditCards: SeedRow[];
}

export function defaultNetWorthSeed(): NetWorthSeed {
  return {
    cash: [
      mkSeedCash('Maybank Savings', 18240.55, 'maybank'),
      mkSeedCash('CIMB Current', 4120.1, 'cimb'),
      mkSeedCash("Touch 'n Go eWallet", 86.4, 'tng'),
      mkSeedCash('GrabPay', 214.75, 'grab'),
    ],
    investments: [
      mkSeedInvest('ASB', 28400.0, null),
      mkSeedInvest('Public Mutual', 13900.0, null),
      mkSeedInvest('Moomoo', 8500.0, 'moomoo'),
    ],
    creditCards: [
      mkSeedCash('Maybank Ikhwan Visa', 1240.3, 'maybank'),
      mkSeedCash('CIMB Cash Rebate Visa', 386.0, 'cimb'),
      mkSeedCash('UOB Preferred Visa', 620.0, 'uob'),
    ],
  };
}

export const NETWORTH_SERIES = [44100, 45300, 46800, 47600, 49500, 51200, 52400, 54100, 56600, 60200, 63900, 67100, 71216];
export const NETWORTH_1M = [67100, 67550, 68200, 69100, 69800, 70500, 71216];

export interface BudgetItem { id: string; name: string; amount: number | string }
export interface BudgetCategory { id: string; name: string; cap: number; items: BudgetItem[] }
export interface Bucket { key: string; name: string; categories: BudgetCategory[] }

export function mkItem(name: string, amount: number): BudgetItem {
  return { id: uid(), name, amount };
}
export function mkCategory(name: string, cap: number, items: BudgetItem[]): BudgetCategory {
  return { id: uid(), name, cap, items };
}

export function defaultBuckets(): Bucket[] {
  return [
    { key: 'fixed', name: 'Fixed', categories: [
      mkCategory('Housing', 3500, [mkItem('House 1', 2000), mkItem('House 2', 1500)]),
      mkCategory('Utilities', 500, [mkItem('TNB', 200), mkItem('Astro', 100), mkItem('Internet', 200)]),
    ] },
    { key: 'flexible', name: 'Flexible', categories: [
      mkCategory('Food & Drink', 900, [mkItem('Food & Drink', 780)]),
      mkCategory('Transport', 400, [mkItem('Transport', 310)]),
      mkCategory('Shopping', 800, [mkItem('Shopping', 950)]),
      mkCategory('Lifestyle', 1300, [mkItem('Lifestyle', 900)]),
    ] },
    { key: 'goals', name: 'Goals', categories: [
      mkCategory('Emergency fund', 500, [mkItem('Emergency fund', 500)]),
      mkCategory('New laptop fund', 1200, [mkItem('New laptop fund', 320)]),
    ] },
    { key: 'insurance', name: 'Insurance', categories: [
      mkCategory('Life Insurance', 450, [mkItem('Life Insurance', 400)]),
      mkCategory('Medical Insurance', 350, [mkItem('Medical Insurance', 300)]),
      mkCategory('MRTA', 250, [mkItem('MRTA', 200)]),
      mkCategory('Other Insurance', 200, [mkItem('Other Insurance', 180)]),
    ] },
  ];
}

export const MONTH_SUMMARIES: Record<string, { income: number; expenses: number }> = {
  Jan: { income: 9200, expenses: 6800 }, Feb: { income: 9200, expenses: 6100 }, Mar: { income: 9500, expenses: 7200 },
  Apr: { income: 9500, expenses: 6400 }, May: { income: 9800, expenses: 6900 }, Jun: { income: 9800, expenses: 6300 },
  Jul: { income: 9800, expenses: 6960 }, Aug: { income: 9800, expenses: 6960 },
};

export interface ReviewItem { id: string; merchant: string; amount: number; cat: string; dateLabel: string; brand: string; payment: string }

export const REVIEW_ITEMS: ReviewItem[] = [
  { id: 'r1', merchant: 'Grab', amount: 18.5, cat: 'Transport', dateLabel: 'Today, 8:12 AM', brand: 'grab', payment: 'GrabPay' },
  { id: 'r2', merchant: 'Tealive', amount: 12.9, cat: 'Food & Drink', dateLabel: 'Today, 7:35 AM', brand: 'tealive', payment: 'Maybank Visa' },
  { id: 'r3', merchant: 'Guardian', amount: 56.4, cat: 'Health', dateLabel: 'Yesterday', brand: 'guardian', payment: "Touch 'n Go eWallet" },
  { id: 'r4', merchant: 'Shopee', amount: 89.9, cat: 'Shopping', dateLabel: 'Yesterday', brand: 'shopee', payment: 'CIMB Credit Card' },
  { id: 'r5', merchant: 'Astro Invoice', amount: 240.0, cat: 'Bills', dateLabel: 'Detected from Gmail', brand: 'gmail', payment: 'Bank Transfer' },
];

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
