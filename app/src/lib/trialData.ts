// Realistic sample data for Developer mode's "Load trial data" action —
// exists purely so a developer testing the app isn't stuck manually
// re-entering accounts/transactions after every reset. Never reachable by a
// real customer: gated behind userMode === 'developer' in MorePanel.tsx, and
// clearly a deliberate, explicit developer action, not something shown to a
// user as if it were their own real data (unlike the fabricated REVIEW_ITEMS
// this app used to ship with).
import type { ManualData, Subscription } from '../store/types';
import type { ReviewItem, Transaction } from './seedData';
import { mkRecord, mkInvestRow, mkCategory, mkItem, defaultBuckets, type Bucket } from './seedData';
import { isoToDisplayDate, dateGroupFor } from './format';
import { categoryToReliefKey } from './taxEngine';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoIn(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Builds a Transaction from an ISO date directly, rather than "N days ago"
// -- what every 2025 backfilled row below needs (a fixed historical date),
// as opposed to the handful of "recent activity" rows further down that are
// deliberately always relative to today.
function mkTxDated(id: string, merchant: string, cat: string, amount: number, iso: string, opts: { tax?: boolean; reliefKey?: string; payment?: string; brand?: string } = {}): Transaction {
  const dateLabel = isoToDisplayDate(iso);
  const [, m] = iso.split('-');
  return {
    id, merchant, cat, dateLabel, dateGroup: dateGroupFor(dateLabel), month: SHORT_MONTHS[Number(m) - 1],
    amount, tax: !!opts.tax, reliefKey: opts.reliefKey, payment: opts.payment ?? 'Maybank Visa', brand: opts.brand,
  };
}

function mkTx(id: string, merchant: string, cat: string, amount: number, daysAgo: number, opts: { tax?: boolean; reliefKey?: string; payment?: string; brand?: string } = {}): Transaction {
  return mkTxDated(id, merchant, cat, amount, isoDaysAgo(daysAgo), opts);
}

export interface TrialData {
  manual: Pick<ManualData, 'bankAccounts' | 'creditCards' | 'investments'>;
  transactions: Transaction[];
  buckets: Bucket[];
  subs: Subscription[];
  pendingReviewItems: ReviewItem[];
}

// ---------------------------------------------------------------------
// 2025 backfilled history: twelve months of varied, internally-consistent
// transactions telling a real spending "story" (a slow January, a bonus in
// March invested rather than spent, a July travel spike, a big December),
// rather than the same numbers repeated twelve times. Every RM here is a
// real Transaction the app's own selectors sum up -- nothing downstream
// (budgets, stats, tax, net worth) is fed a separately hardcoded total.
// ---------------------------------------------------------------------

const MERCHANTS: Record<string, string[]> = {
  'Food & Drink': ['Village Grocer', 'Tealive', 'Old Town White Coffee', 'Mamak Corner', 'Jaya Grocer', "McDonald's", 'Sushi King', 'Starbucks'],
  Transport: ['Grab', 'Petronas', 'Shell', "Touch 'n Go Toll", 'MRT Feeder Bus'],
  Shopping: ['Uniqlo', 'H&M', 'Shopee', 'Lazada', 'IKEA', 'Watsons'],
  Bills: ['TNB Electricity', 'Unifi Internet', 'Maxis Postpaid', 'Indah Water'],
  Lifestyle: ['Netflix', 'GSC Cinemas', 'Popular Bookstore', 'Fitness First Gym', 'Spotify'],
  Health: ['Guardian Pharmacy', 'Caring Pharmacy', 'KPJ Clinic'],
};

const BRAND_FOR: Record<string, string> = { Grab: 'grab', Shopee: 'shopee', Watsons: 'guardian', Netflix: 'netflix' };

interface MonthPlan {
  salary: number; bonus: number;
  food: number; transport: number; shopping: number; bills: number; lifestyle: number; health: number;
  invest: number; note: string;
}

const MONTH_2025_PLAN: MonthPlan[] = [
  { salary: 5500, bonus: 0, food: 900, transport: 350, shopping: 750, bills: 700, lifestyle: 300, health: 80, invest: 200, note: 'Post-New Year spending spike' },
  { salary: 5500, bonus: 0, food: 550, transport: 280, shopping: 200, bills: 700, lifestyle: 150, health: 0, invest: 200, note: 'Quiet month, spending pulled back' },
  { salary: 5500, bonus: 2000, food: 700, transport: 300, shopping: 350, bills: 700, lifestyle: 200, health: 60, invest: 2500, note: 'Bonus month — most of it invested' },
  { salary: 5500, bonus: 0, food: 680, transport: 320, shopping: 400, bills: 720, lifestyle: 220, health: 0, invest: 300, note: 'Back to a normal month' },
  { salary: 5500, bonus: 0, food: 750, transport: 300, shopping: 600, bills: 700, lifestyle: 250, health: 50, invest: 300, note: 'Shopping-heavy month' },
  { salary: 5500, bonus: 0, food: 600, transport: 280, shopping: 250, bills: 700, lifestyle: 180, health: 0, invest: 800, note: 'Mid-year top-up to investments' },
  { salary: 5500, bonus: 0, food: 820, transport: 400, shopping: 500, bills: 700, lifestyle: 350, health: 40, invest: 300, note: 'School holidays — travel & dining up' },
  { salary: 5500, bonus: 0, food: 600, transport: 300, shopping: 300, bills: 700, lifestyle: 200, health: 0, invest: 300, note: 'Steady month' },
  { salary: 5500, bonus: 0, food: 650, transport: 310, shopping: 280, bills: 720, lifestyle: 200, health: 70, invest: 1000, note: 'Q3 catch-up investment contribution' },
  { salary: 5500, bonus: 0, food: 700, transport: 300, shopping: 450, bills: 700, lifestyle: 220, health: 0, invest: 300, note: 'Normal month' },
  { salary: 5500, bonus: 0, food: 620, transport: 290, shopping: 350, bills: 700, lifestyle: 180, health: 60, invest: 300, note: 'Normal month' },
  { salary: 5500, bonus: 1500, food: 950, transport: 350, shopping: 1200, bills: 750, lifestyle: 400, health: 0, invest: 500, note: 'Year-end bonus & holiday spending' },
];

// Deterministic, front-loaded split of a monthly category total into n
// individual transactions that sum to EXACTLY that total (no rounding
// drift) -- varied-looking amounts instead of n identical line items.
function splitAmounts(total: number, n: number): number[] {
  if (n <= 0 || total <= 0) return [];
  const raw = Array.from({ length: n }, (_, i) => 1 / (i + 1.4));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const amounts = raw.map((w) => Math.round((total * w) / rawSum));
  const diff = total - amounts.reduce((a, b) => a + b, 0);
  amounts[0] += diff;
  return amounts;
}

const DAY_SLOTS = [3, 8, 13, 18, 23, 27];

// Category -> {tx count that month, which of those are tax-deductible}.
// Only Lifestyle/Health/Shopping/Bills ever carry a relief key (see
// categoryToReliefKey) -- Food & Drink and Transport are never deductible,
// matching real LHDN relief categories, so this data doesn't pretend
// otherwise. Not every eligible transaction is marked deductible either:
// only the first (largest, post-split) one per month per category, the way
// a real user would actually only keep/scan some of their receipts.
function categoryTxCount(cat: string): number {
  switch (cat) {
    case 'Food & Drink': return 4;
    case 'Transport': return 3;
    case 'Shopping': return 3;
    case 'Bills': return 3;
    case 'Lifestyle': return 3;
    case 'Health': return 1;
    default: return 1;
  }
}

function build2025Transactions(): { transactions: Transaction[]; monthlyIncome: number[]; monthlyExpense: number[] } {
  const transactions: Transaction[] = [];
  const monthlyIncome: number[] = [];
  const monthlyExpense: number[] = [];

  MONTH_2025_PLAN.forEach((plan, mi) => {
    const monthNum = String(mi + 1).padStart(2, '0');
    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    // Income: salary always on the 25th, an occasional bonus alongside it.
    const salaryIso = `2025-${monthNum}-25`;
    transactions.push(mkTxDated(`y25-${monthNum}-salary`, 'Salary', 'Income', plan.salary, salaryIso, { payment: 'Bank Transfer' }));
    incomeThisMonth += plan.salary;
    if (plan.bonus > 0) {
      transactions.push(mkTxDated(`y25-${monthNum}-bonus`, 'Annual Bonus', 'Income', plan.bonus, salaryIso, { payment: 'Bank Transfer' }));
      incomeThisMonth += plan.bonus;
    }

    (['Food & Drink', 'Transport', 'Shopping', 'Bills', 'Lifestyle', 'Health'] as const).forEach((cat) => {
      const total = plan[cat === 'Food & Drink' ? 'food' : cat === 'Transport' ? 'transport' : cat === 'Shopping' ? 'shopping' : cat === 'Bills' ? 'bills' : cat === 'Lifestyle' ? 'lifestyle' : 'health'];
      if (total <= 0) return;
      const n = Math.min(categoryTxCount(cat), DAY_SLOTS.length);
      const amounts = splitAmounts(total, n);
      const pool = MERCHANTS[cat];
      const deductible = ['Lifestyle', 'Health', 'Shopping', 'Bills'].includes(cat);
      const reliefKey = deductible ? categoryToReliefKey(cat) ?? undefined : undefined;
      amounts.forEach((amt, i) => {
        const merchant = pool[(mi + i) % pool.length];
        const iso = `2025-${monthNum}-${String(DAY_SLOTS[i]).padStart(2, '0')}`;
        transactions.push(mkTxDated(
          `y25-${monthNum}-${cat.replace(/[^a-z]/gi, '').toLowerCase()}-${i}`,
          merchant, cat, -amt, iso,
          { tax: deductible && i === 0, reliefKey: deductible && i === 0 ? reliefKey : undefined, brand: BRAND_FOR[merchant] },
        ));
        expenseThisMonth += amt;
      });
    });

    monthlyIncome.push(incomeThisMonth);
    monthlyExpense.push(expenseThisMonth);
  });

  return { transactions, monthlyIncome, monthlyExpense };
}

export function buildTrialData(): TrialData {
  const { transactions: tx2025, monthlyIncome, monthlyExpense } = build2025Transactions();

  // Cash-account history: each month's real net saved (real income minus
  // real expenses, both summed from the transactions just built above,
  // minus that month's investment contribution) becomes one dated
  // BalanceEntry delta. Nothing here is a second, independently-typed
  // total -- income/expense are read back off tx2025, not restated.
  const cashHistory = MONTH_2025_PLAN.map((plan, mi) => {
    const monthNum = String(mi + 1).padStart(2, '0');
    const netSaved = monthlyIncome[mi] - monthlyExpense[mi] - plan.invest;
    return { id: `y25-cash-${monthNum}`, amount: netSaved, desc: plan.note, date: `2025-${monthNum}-28` };
  });
  const cashBase = 8000;
  const cashEnding = cashBase + cashHistory.reduce((s, e) => s + e.amount, 0);

  // The total actually contributed across 2025, read back from the same
  // plan the cash-account deltas above were derived from -- not a separate
  // hardcoded figure. InvestRow has no `history` field (unlike RecordRow),
  // so -- unlike the cash account above -- this total applies as a single
  // flat current value rather than growing month-by-month on the net worth
  // chart; that's an existing limitation of computeNetWorthTimeline
  // (investTotal is summed once, not date-scoped), not something invented
  // here, and is called out in the final report as a discovered gap.
  const totalInvested = MONTH_2025_PLAN.reduce((s, p) => s + p.invest, 0);

  const manual: Pick<ManualData, 'bankAccounts' | 'creditCards' | 'investments'> = {
    bankAccounts: [
      { ...mkRecord('Maybank Savings', String(cashEnding), '2025-01-01'), history: cashHistory },
      mkRecord('CIMB Current', '1800', isoDaysAgo(7)),
    ],
    creditCards: [
      mkRecord('Maybank Visa', '650', isoDaysAgo(10)),
    ],
    investments: [
      mkInvestRow('ASB Investment', '1', String(totalInvested), String(totalInvested)),
    ],
  };

  // "Recent activity" — a handful of transactions dated relative to today
  // (not part of the 2025 backfill) so Home/Record still show something in
  // the current month the moment trial data loads.
  const recentTransactions: Transaction[] = [
    mkTx('trial-1', 'Grab', 'Transport', -18.5, 1, { payment: 'GrabPay', brand: 'grab' }),
    mkTx('trial-2', 'Starbucks', 'Food & Drink', -15.9, 2),
    mkTx('trial-3', 'Decathlon', 'Lifestyle', -238, 5, { tax: true, reliefKey: 'life_general' }),
    mkTx('trial-4', 'Guardian Pharmacy', 'Health', -42.3, 6, { tax: true, reliefKey: 'med_self', brand: 'guardian' }),
    mkTx('trial-5', 'Tesco', 'Shopping', -96.4, 8),
    mkTx('trial-6', 'Salary', 'Income', 5500, 14, { payment: 'Bank Transfer' }),
  ];

  const transactions: Transaction[] = [...tx2025, ...recentTransactions];

  const buckets = defaultBuckets().map((b) => {
    if (b.key === 'fixed') return { ...b, categories: [mkCategory('Housing', 1500, [mkItem('Rent', 1500)])] };
    if (b.key === 'flexible') return { ...b, categories: [mkCategory('Food & Drink', 600, [mkItem('Groceries + dining', 340)])] };
    return b;
  });

  const subs: Subscription[] = [
    { name: 'Netflix', amount: '54.90', frequency: 'Monthly', startDate: isoDaysAgo(40), nextPayment: isoIn(20), method: 'Maybank Visa', category: 'Entertainment' },
  ];

  const pendingReviewItems: ReviewItem[] = [
    { id: 'trial-rv-1', merchant: 'Shopee', amount: -189.9, cat: 'Shopping', dateLabel: isoToDisplayDate(isoDaysAgo(1)), brand: 'shopee', payment: 'Maybank Visa' },
    { id: 'trial-rv-2', merchant: 'Grab', amount: -24.5, cat: 'Transport', dateLabel: isoToDisplayDate(isoDaysAgo(2)), brand: 'grab', payment: 'GrabPay' },
    { id: 'trial-rv-3', merchant: 'Tealive', amount: -9.9, cat: 'Food & Drink', dateLabel: isoToDisplayDate(isoDaysAgo(3)), brand: 'tealive', payment: "Touch 'n Go eWallet" },
  ];

  return { manual, transactions, buckets, subs, pendingReviewItems };
}

export function emptyTrialData(): TrialData {
  return { manual: { bankAccounts: [], creditCards: [], investments: [] }, transactions: [], buckets: defaultBuckets(), subs: [], pendingReviewItems: [] };
}
