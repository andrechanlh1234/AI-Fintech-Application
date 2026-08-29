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
// -- what every backfilled row below needs (a fixed historical date), as
// opposed to pendingReviewItems further down, which are deliberately always
// relative to today (simulating a bank statement imported just now).
function mkTxDated(id: string, merchant: string, cat: string, amount: number, iso: string, opts: { tax?: boolean; reliefKey?: string; payment?: string; brand?: string } = {}): Transaction {
  const dateLabel = isoToDisplayDate(iso);
  const [, m] = iso.split('-');
  return {
    id, merchant, cat, dateLabel, dateGroup: dateGroupFor(dateLabel), month: SHORT_MONTHS[Number(m) - 1],
    amount, tax: !!opts.tax, reliefKey: opts.reliefKey, payment: opts.payment ?? 'Maybank Visa', brand: opts.brand,
  };
}

export interface TrialData {
  manual: Pick<ManualData, 'bankAccounts' | 'creditCards' | 'investments'>;
  transactions: Transaction[];
  buckets: Bucket[];
  subs: Subscription[];
  pendingReviewItems: ReviewItem[];
}

// ---------------------------------------------------------------------
// 20-month backfilled history (Jan 2025 - Aug 2026, ending on today's real
// month): a real spending "story" across the full Essential/Lifestyle/
// Money/Others category taxonomy, not the same handful of categories
// repeated. Every RM here is a real Transaction the app's own selectors
// sum up -- nothing downstream (budgets, stats, tax, net worth) is fed a
// separately hardcoded total.
// ---------------------------------------------------------------------

// Deterministic per-(month,category) variation -- same seed always produces
// the same "random-looking" jitter, so trial data is stable across repeated
// "Load trial data" clicks instead of reshuffling every time (the same
// determinism principle as splitAmounts below, just for a different job:
// picking which occasional categories fire in a given month, and by how
// much amounts wobble around their base).
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  let state = (h >>> 0) || 1;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Deterministic, front-loaded split of a category total into n individual
// transactions that sum to EXACTLY that total (no rounding drift) --
// varied-looking amounts instead of n identical line items.
function splitAmounts(total: number, n: number, rand: () => number): number[] {
  if (n <= 0 || total <= 0) return [];
  const raw = Array.from({ length: n }, () => 0.6 + rand() * 0.8);
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const amounts = raw.map((w) => Math.round((total * w) / rawSum));
  const diff = total - amounts.reduce((a, b) => a + b, 0);
  amounts[0] += diff;
  return amounts;
}

interface MonthPlan {
  year: number; month: number; // month is 1-12
  salary: number; bonus: number;
  essentialLevel: number; // multiplier on each essential category's base amount
  lifestyleLevel: number; // multiplier on each lifestyle category's base amount
  travel: boolean; // this month gets a Travel line item
  festive: boolean; // this month's Gifts/Donations frequency + amounts bump up
  invest: number;
  note: string;
}

// A real income progression (a raise in Feb 2026), bonuses at the usual
// March/December points, and a level (not a hardcoded amount) driving each
// category's spend per month -- the categories themselves, their per-month
// counts, and their base amounts live in CATEGORY_PROFILES below, so this
// table only has to carry the "story", not every individual number.
const MONTH_PLAN: MonthPlan[] = [
  { year: 2024, month: 7, salary: 5200, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 250, note: 'Early history -- steady month' },
  { year: 2024, month: 8, salary: 5200, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.05, travel: false, festive: false, invest: 250, note: 'Steady month' },
  { year: 2024, month: 9, salary: 5200, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 0.95, travel: false, festive: false, invest: 600, note: 'Extra investment contribution' },
  { year: 2024, month: 10, salary: 5200, bonus: 0, essentialLevel: 1.05, lifestyleLevel: 1.1, travel: true, festive: false, invest: 300, note: 'Short getaway' },
  { year: 2024, month: 11, salary: 5200, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 250, note: 'Steady month' },
  { year: 2024, month: 12, salary: 5200, bonus: 1200, essentialLevel: 1.2, lifestyleLevel: 1.35, travel: false, festive: true, invest: 400, note: 'Year-end bonus, holidays, gifts' },
  { year: 2025, month: 1, salary: 5500, bonus: 0, essentialLevel: 1.2, lifestyleLevel: 1.0, travel: false, festive: true, invest: 200, note: 'Salary raise kicks in, post-New Year spending' },
  { year: 2025, month: 2, salary: 5500, bonus: 0, essentialLevel: 0.85, lifestyleLevel: 0.7, travel: false, festive: true, invest: 200, note: 'Quiet month, festive season tapering off' },
  { year: 2025, month: 3, salary: 5500, bonus: 2000, essentialLevel: 1.0, lifestyleLevel: 0.9, travel: false, festive: false, invest: 2500, note: 'Bonus month -- most of it invested' },
  { year: 2025, month: 4, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 300, note: 'Back to a normal month' },
  { year: 2025, month: 5, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.1, travel: false, festive: false, invest: 300, note: 'Slight lifestyle uptick' },
  { year: 2025, month: 6, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.3, travel: true, festive: false, invest: 800, note: 'Mid-year school holidays -- short trip' },
  { year: 2025, month: 7, salary: 5500, bonus: 0, essentialLevel: 1.1, lifestyleLevel: 1.2, travel: true, festive: false, invest: 300, note: 'School holidays continue, travel spike' },
  { year: 2025, month: 8, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 300, note: 'Back to normal' },
  { year: 2025, month: 9, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 0.9, travel: false, festive: false, invest: 1000, note: 'Q3 catch-up investment contribution' },
  { year: 2025, month: 10, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 300, note: 'Steady month' },
  { year: 2025, month: 11, salary: 5500, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 300, note: 'Steady month' },
  { year: 2025, month: 12, salary: 5500, bonus: 1500, essentialLevel: 1.2, lifestyleLevel: 1.4, travel: false, festive: true, invest: 500, note: 'Year-end bonus, holidays, gifts' },
  { year: 2026, month: 1, salary: 5500, bonus: 0, essentialLevel: 1.15, lifestyleLevel: 1.1, travel: false, festive: true, invest: 300, note: "New Year resolutions -- fitness push" },
  { year: 2026, month: 2, salary: 5800, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 0.9, travel: false, festive: true, invest: 300, note: 'Salary raise kicks in, festive season' },
  { year: 2026, month: 3, salary: 5800, bonus: 2200, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 2800, note: 'Bonus month' },
  { year: 2026, month: 4, salary: 5800, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 350, note: 'Normal month' },
  { year: 2026, month: 5, salary: 5800, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.1, travel: false, festive: false, invest: 350, note: 'Slight lifestyle uptick' },
  { year: 2026, month: 6, salary: 5800, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.3, travel: true, festive: false, invest: 900, note: 'Mid-year travel' },
  { year: 2026, month: 7, salary: 5800, bonus: 0, essentialLevel: 1.05, lifestyleLevel: 1.1, travel: false, festive: false, invest: 350, note: 'Back to normal' },
  { year: 2026, month: 8, salary: 5800, bonus: 0, essentialLevel: 1.0, lifestyleLevel: 1.0, travel: false, festive: false, invest: 350, note: 'Steady month, brings us to today' },
];

interface CategoryProfile {
  group: 'essential' | 'lifestyle' | 'money' | 'others';
  merchants: { name: string; brand?: string }[];
  base: number; // typical monthly total at level=1
  count: number; // transactions per month when this category fires
  frequency: number; // 0-1 chance this category fires in a given month
  festiveBoost?: number; // frequency/amount multiplier applied in festive months
}

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  'Food & Drink': { group: 'essential', base: 700, count: 5, frequency: 1, merchants: [
    { name: 'Village Grocer' }, { name: 'Tealive', brand: 'tealive' }, { name: 'Old Town White Coffee' },
    { name: 'Mamak Corner' }, { name: "McDonald's" }, { name: 'Sushi King' }, { name: 'Starbucks' },
  ] },
  Groceries: { group: 'essential', base: 350, count: 3, frequency: 1, merchants: [
    { name: 'Jaya Grocer' }, { name: 'AEON' }, { name: "Lotus's" }, { name: 'Mydin' }, { name: 'NSK Trade City' },
  ] },
  Transport: { group: 'essential', base: 300, count: 4, frequency: 1, merchants: [
    { name: 'Grab', brand: 'grab' }, { name: "Touch 'n Go Toll", brand: 'tng' }, { name: 'RapidKL' }, { name: 'KTM Komuter' },
  ] },
  Petrol: { group: 'essential', base: 220, count: 2, frequency: 0.95, merchants: [
    { name: 'Petronas' }, { name: 'Shell' }, { name: 'Caltex' },
  ] },
  Bills: { group: 'essential', base: 700, count: 4, frequency: 1, merchants: [
    { name: 'TNB Electricity' }, { name: 'Unifi Internet' }, { name: 'Maxis Postpaid' }, { name: 'Indah Water' }, { name: 'Astro' },
  ] },
  Insurance: { group: 'essential', base: 380, count: 1, frequency: 0.6, merchants: [
    { name: 'Great Eastern' }, { name: 'AIA' }, { name: 'Allianz' }, { name: 'Prudential' },
  ] },
  Medical: { group: 'essential', base: 120, count: 1, frequency: 0.7, merchants: [
    { name: 'Guardian Pharmacy', brand: 'guardian' }, { name: 'Caring Pharmacy' }, { name: 'KPJ Clinic' },
  ] },
  Family: { group: 'essential', base: 250, count: 1, frequency: 0.5, merchants: [
    { name: 'Toys "R" Us' }, { name: 'KidZania' }, { name: "Poh Kong" },
  ] },
  Education: { group: 'essential', base: 900, count: 1, frequency: 0.25, merchants: [
    { name: 'Kumon' }, { name: 'British Council' }, { name: 'Udemy' },
  ] },
  Home: { group: 'essential', base: 300, count: 1, frequency: 0.45, merchants: [
    { name: 'IKEA' }, { name: 'Mr DIY' }, { name: 'Harvey Norman' }, { name: 'Courts' },
  ] },
  Shopping: { group: 'lifestyle', base: 400, count: 3, frequency: 1, merchants: [
    { name: 'Uniqlo' }, { name: 'H&M' }, { name: 'Shopee', brand: 'shopee' }, { name: 'Lazada' }, { name: 'Zalora' },
  ] },
  Entertainment: { group: 'lifestyle', base: 150, count: 3, frequency: 0.9, merchants: [
    { name: 'GSC Cinemas' }, { name: 'TGV Cinemas' }, { name: 'Timezone' },
  ] },
  Fitness: { group: 'lifestyle', base: 150, count: 1, frequency: 0.9, merchants: [
    { name: 'Fitness First Gym' }, { name: 'Celebrity Fitness' }, { name: 'Anytime Fitness' },
  ] },
  Wellness: { group: 'lifestyle', base: 120, count: 1, frequency: 0.6, merchants: [
    { name: 'Yoga Movement' }, { name: 'Sunway Medical Spa' },
  ] },
  Hobbies: { group: 'lifestyle', base: 180, count: 1, frequency: 0.6, merchants: [
    { name: 'Popular Bookstore' }, { name: 'Kinokuniya' }, { name: 'Steam' },
  ] },
  Travel: { group: 'lifestyle', base: 1200, count: 2, frequency: 0, merchants: [
    { name: 'AirAsia' }, { name: 'Malaysia Airlines' }, { name: 'Agoda' }, { name: 'Traveloka' },
  ] }, // frequency 0 -- only fires on plan.travel months, handled explicitly below
  Transfers: { group: 'money', base: 300, count: 1, frequency: 0.4, merchants: [{ name: 'DuitNow Transfer' }] },
  Fees: { group: 'money', base: 25, count: 1, frequency: 0.45, merchants: [{ name: 'Bank Service Charge' }] },
  ATM: { group: 'money', base: 200, count: 1, frequency: 0.45, merchants: [{ name: 'Maybank ATM', brand: 'maybank' }, { name: 'CIMB ATM', brand: 'cimb' }] },
  Services: { group: 'others', base: 180, count: 1, frequency: 0.35, merchants: [{ name: 'Aircond Servicing' }, { name: 'Car Workshop' }] },
  General: { group: 'others', base: 100, count: 1, frequency: 0.45, merchants: [{ name: '7-Eleven' }, { name: 'KK Mart' }] },
  Donations: { group: 'others', base: 100, count: 1, frequency: 0.2, festiveBoost: 2.5, merchants: [{ name: 'MERCY Malaysia' }, { name: 'MyKasih' }] },
  Gifts: { group: 'others', base: 150, count: 1, frequency: 0.2, festiveBoost: 2.5, merchants: [{ name: "Poh Kong" }, { name: 'FaSoLa Gifts' }] },
};

function catSlug(cat: string): string {
  return cat.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function build2025To2026Transactions(): { transactions: Transaction[]; monthlyIncome: number[]; monthlyExpense: number[] } {
  const transactions: Transaction[] = [];
  const monthlyIncome: number[] = [];
  const monthlyExpense: number[] = [];

  MONTH_PLAN.forEach((plan) => {
    const yy = String(plan.year).slice(2);
    const mm = String(plan.month).padStart(2, '0');
    const idPrefix = `y${yy}-${mm}`;
    let incomeThisMonth = 0;
    let expenseThisMonth = 0;

    // Income: salary always on the 25th, an occasional bonus alongside it.
    const salaryIso = `${plan.year}-${mm}-25`;
    transactions.push(mkTxDated(`${idPrefix}-salary`, 'Salary', 'Income', plan.salary, salaryIso, { payment: 'Bank Transfer' }));
    incomeThisMonth += plan.salary;
    if (plan.bonus > 0) {
      transactions.push(mkTxDated(`${idPrefix}-bonus`, 'Annual Bonus', 'Income', plan.bonus, salaryIso, { payment: 'Bank Transfer' }));
      incomeThisMonth += plan.bonus;
    }

    Object.entries(CATEGORY_PROFILES).forEach(([cat, profile]) => {
      const rand = seededRandom(`${plan.year}-${plan.month}-${cat}`);
      const isTravelMonth = cat === 'Travel' && plan.travel;
      let frequency = profile.frequency;
      if (profile.festiveBoost && plan.festive) frequency = Math.min(1, frequency * profile.festiveBoost);
      if (!isTravelMonth && rand() > frequency) return; // this category doesn't fire this month

      const level = profile.group === 'essential' ? plan.essentialLevel : profile.group === 'lifestyle' ? plan.lifestyleLevel : 1;
      const festiveAmountBoost = profile.festiveBoost && plan.festive ? profile.festiveBoost : 1;
      const total = Math.round(profile.base * level * festiveAmountBoost * (0.85 + rand() * 0.3));
      if (total <= 0) return;

      const amounts = splitAmounts(total, profile.count, rand);
      const deductible = categoryToReliefKey(cat) != null;
      const reliefKey = deductible ? categoryToReliefKey(cat) ?? undefined : undefined;

      amounts.forEach((amt, i) => {
        if (amt <= 0) return;
        const merchant = profile.merchants[Math.floor(rand() * profile.merchants.length)];
        const day = 2 + Math.floor(rand() * 26); // spread across the month, day 2-27
        const iso = `${plan.year}-${mm}-${String(day).padStart(2, '0')}`;
        transactions.push(mkTxDated(
          `${idPrefix}-${catSlug(cat)}-${i}`,
          merchant.name, cat, -amt, iso,
          // Not every eligible transaction is marked deductible -- only the
          // first (largest, post-split) one per month per category, the way
          // a real user would actually only keep/scan some of their receipts.
          { tax: deductible && i === 0, reliefKey: deductible && i === 0 ? reliefKey : undefined, brand: merchant.brand },
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
  const { transactions: backfilled, monthlyIncome, monthlyExpense } = build2025To2026Transactions();

  // Cash-account history: each month's real net saved (real income minus
  // real expenses, both summed from the transactions just built above,
  // minus that month's investment contribution) becomes two dated
  // BalanceEntry deltas -- split (not just repeated) across a mid-month and
  // end-of-month date, since salary lands on the 25th and most spending
  // trails through the rest of the month. Splitting instead of a single
  // month-end entry doubles the net-worth chart's tappable points (one
  // MONTH_PLAN entry's story becomes two distinct dated deltas) while the
  // two amounts still sum to exactly that month's real net saved -- nothing
  // here is a second, independently-typed total.
  const cashHistory = MONTH_PLAN.flatMap((plan, mi) => {
    const yy = String(plan.year).slice(2);
    const mm = String(plan.month).padStart(2, '0');
    const netSaved = monthlyIncome[mi] - monthlyExpense[mi] - plan.invest;
    const rand = seededRandom(`${plan.year}-${plan.month}-cash-split`);
    const midShare = Math.round(netSaved * (0.35 + rand() * 0.15)); // ~35-50% by mid-month
    return [
      { id: `y${yy}-cash-${mm}-mid`, amount: midShare, desc: plan.note, date: `${plan.year}-${mm}-13` },
      { id: `y${yy}-cash-${mm}-end`, amount: netSaved - midShare, desc: plan.note, date: `${plan.year}-${mm}-28` },
    ];
  });
  const cashBase = 8000;
  const cashEnding = cashBase + cashHistory.reduce((s, e) => s + e.amount, 0);

  // The total actually contributed across the whole 20-month backfill, read
  // back from the same plan the cash-account deltas above were derived
  // from -- not a separate hardcoded figure. InvestRow has no `history`
  // field (unlike RecordRow), so -- unlike the cash account above -- this
  // total applies as a single flat current value rather than growing
  // month-by-month on the net worth chart; that's an existing limitation of
  // computeNetWorthTimeline (investTotal is summed once, not date-scoped),
  // not something invented here.
  const totalInvested = MONTH_PLAN.reduce((s, p) => s + p.invest, 0);

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

  const buckets = defaultBuckets().map((b) => {
    if (b.key === 'fixed') return { ...b, categories: [{ ...mkCategory('Housing', 1500, [mkItem('Rent', 1500)]), recurring: true, recurDay: 1 }] };
    if (b.key === 'flexible') return { ...b, categories: [mkCategory('Food & Drink', 600, [mkItem('Groceries + dining', 340)])] };
    return b;
  });

  const subs: Subscription[] = [
    { name: 'Netflix', amount: '54.90', frequency: 'Monthly', startDate: isoDaysAgo(40), nextPayment: isoIn(20), method: 'Maybank Visa', category: 'Entertainment' },
  ];

  // A fresh, not-yet-reviewed "bank statement import" -- deliberately
  // relative to today (unlike the whole backfill above), so Home's "items
  // to review" has something the moment trial data loads regardless of
  // which real-world day it's loaded on.
  const pendingReviewItems: ReviewItem[] = [
    { id: 'trial-rv-1', merchant: 'Shopee', name: 'Shopee', amount: -189.9, cat: 'Shopping', dateIso: isoDaysAgo(1), dateLabel: isoToDisplayDate(isoDaysAgo(1)), brand: 'shopee', payment: 'Maybank Visa', taxDeductible: true, kind: 'expense' },
    { id: 'trial-rv-2', merchant: 'Grab', name: 'Grab', amount: -24.5, cat: 'Transport', dateIso: isoDaysAgo(2), dateLabel: isoToDisplayDate(isoDaysAgo(2)), brand: 'grab', payment: 'GrabPay', taxDeductible: false, kind: 'expense' },
    { id: 'trial-rv-3', merchant: 'Tealive', name: 'Tealive', amount: -9.9, cat: 'Food & Drink', dateIso: isoDaysAgo(3), dateLabel: isoToDisplayDate(isoDaysAgo(3)), brand: 'tealive', payment: "Touch 'n Go eWallet", taxDeductible: false, kind: 'expense' },
  ];

  return { manual, transactions: backfilled, buckets, subs, pendingReviewItems };
}

export function emptyTrialData(): TrialData {
  return { manual: { bankAccounts: [], creditCards: [], investments: [] }, transactions: [], buckets: defaultBuckets(), subs: [], pendingReviewItems: [] };
}
