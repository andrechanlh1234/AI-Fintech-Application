// Derived/computed view-model selectors ported from Cukai v7.dc.html's
// renderVals() (lines 2345-2790). Pure functions of AppState — no dispatch,
// no bound handlers. Screens read data from these and bind interactions via
// useActions() directly (e.g. onClick={() => actions.openBalanceDetail(...)}).
import type { AppState } from './types';
import { money, moneyWhole, clamp, todayIso, isoToGroupLabel } from '../lib/format';
import {
  type Transaction, type BudgetCategory, type BalanceEntry, type RecordRow,
} from '../lib/seedData';
import { CAT_ICON, CAT_COLOR, NW_GROUP_ICON, rowBadge, deriveTxDate, MONTH_ORDER, txDateIso } from '../lib/constants';
import {
  buildTaxModel, estimateAnnualIncome, marginalTaxRate, ASSUMED_TAX_RATE,
  TAX_ITEMS_META, type TaxProfile, type TaxItemData,
} from '../lib/taxEngine';
import { lineItemIsInvalid, lineItemNeedsReview } from '../lib/receipts';

/** Real deductible transactions (tax=true) for a given tax year, grouped by
 * LHDN relief item key, in the shape buildTaxModel() expects. No hardcoded
 * amounts — every RM here traces back to a transaction the user actually
 * scanned or accepted from review. Transactions without a reliefKey (e.g.
 * scan categories with no clear LHDN mapping) are omitted rather than
 * guessed into a bucket. */
function buildCapturedData(transactions: Transaction[], taxYear: string): Record<string, TaxItemData> {
  const targetYear = taxYear.replace(/^YA/, '');
  const data: Record<string, TaxItemData> = {};
  transactions.forEach((t) => {
    if (!t.tax || !t.reliefKey) return;
    const yearMatch = t.dateLabel.match(/\b(20\d{2})\b/);
    if (yearMatch && yearMatch[1] !== targetYear) return;
    const amount = Math.abs(t.amount);
    const entry = data[t.reliefKey] || (data[t.reliefKey] = { captured: 0, receipts: [] });
    entry.captured += amount;
    entry.receipts.push({ merchant: t.merchant, amount, dateLabel: t.dateLabel });
  });
  return data;
}

function sumOb(state: AppState, listKey: 'bankAccounts' | 'creditCards' | 'properties' | 'otherAssets' | 'liabilities') {
  return state.ob.manual[listKey].reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
}

export interface NwRow {
  name: string; subLabel: string; balanceValue: number; brand?: string | null;
  clickable: boolean; listKey: string; id: string | null;
  /** Manual entries (the common case, since there's no real bank sync) are
   * edited inline right in this row — name/amount text fields — rather than
   * through a tap-to-detail modal, so a freshly-added blank row is visible
   * and fillable immediately instead of disappearing until it has a name. */
  isManual: boolean;
  qty?: string; buy?: string; cur?: string; idx?: number; // manual investment rows only
  rawAmount?: string; // manual asset/liability rows only — bind inputs to this, not balanceValue
  rawDate?: string; // manual asset/liability rows only — the "as of" date behind computeNetWorthTimeline
}

export function selectNetWorth(state: AppState) {
  const ob = state.ob;
  const seedCashTotal = state.netWorthSeed.cash.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const seedCreditTotal = state.netWorthSeed.creditCards.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const seedInvestTotal = state.netWorthSeed.investments.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), 0);
  const obBankTotal = sumOb(state, 'bankAccounts'), obCreditTotal = sumOb(state, 'creditCards');
  const obPropertyTotal = sumOb(state, 'properties'), obOtherAssetTotal = sumOb(state, 'otherAssets'), obLiabilityTotal = sumOb(state, 'liabilities');
  const manualInvestTotal = ob.manual.investments.filter((r) => r.name).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), 0);

  const cashTotalVal = seedCashTotal + obBankTotal;
  const investTotalVal = seedInvestTotal + manualInvestTotal;
  const otherAssetsTotalVal = obPropertyTotal + obOtherAssetTotal;
  const liabTotalVal = seedCreditTotal + obCreditTotal + obLiabilityTotal;

  const nwSeedRow = (name: string, amount: number, listKey: string, id: string, brand?: string | null): NwRow =>
    ({ name, subLabel: 'Synced · tap to edit', balanceValue: amount, brand, clickable: true, listKey, id, isManual: false });
  const nwManualRow = (name: string, amount: number, listKey: string, id: string, rawAmount: string, rawDate?: string): NwRow =>
    ({ name, subLabel: 'Manual · tap for details', balanceValue: amount, clickable: true, listKey, id, isManual: true, rawAmount, rawDate });
  const nwInvestRow = (r: { name: string; qty: string; buy: string; cur: string; id: string; brand?: string | null }, listKey: string, isManual: boolean, idx?: number): NwRow =>
    ({ name: r.name, subLabel: isManual ? 'Manual · tap for details' : 'Synced · tap to edit', balanceValue: (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), brand: r.brand, clickable: true, listKey, id: r.id, isManual, qty: r.qty, buy: r.buy, cur: r.cur, idx });

  const groups = [
    { key: 'cash', label: 'Cash', totalVal: cashTotalVal, rows: [
      ...state.netWorthSeed.cash.map((r) => nwSeedRow(r.name, parseFloat(r.amount) || 0, 'seed.cash', r.id, r.brand)),
      ...ob.manual.bankAccounts.map((r) => nwManualRow(r.name, parseFloat(r.amount) || 0, 'bankAccounts', r.id, r.amount, r.date)),
    ] },
    { key: 'invest', label: 'Investments', totalVal: investTotalVal, rows: [
      ...state.netWorthSeed.investments.map((r) => nwInvestRow(r, 'seed.investments', false)),
      ...ob.manual.investments.map((r, i) => nwInvestRow({ ...r, id: r.id || 'mi' + i }, 'investments', true, i)),
    ] },
    { key: 'other', label: 'Other assets', totalVal: otherAssetsTotalVal, rows: [
      ...ob.manual.properties.map((r) => nwManualRow(r.name, parseFloat(r.amount) || 0, 'properties', r.id, r.amount, r.date)),
      ...ob.manual.otherAssets.map((r) => nwManualRow(r.name, parseFloat(r.amount) || 0, 'otherAssets', r.id, r.amount, r.date)),
    ] },
    { key: 'liab', label: 'Liabilities', totalVal: liabTotalVal, rows: [
      ...state.netWorthSeed.creditCards.map((r) => nwSeedRow(r.name, parseFloat(r.amount) || 0, 'seed.creditCards', r.id, r.brand)),
      ...ob.manual.creditCards.map((r) => nwManualRow(r.name, parseFloat(r.amount) || 0, 'creditCards', r.id, r.amount, r.date)),
      ...ob.manual.liabilities.map((r) => nwManualRow(r.name, parseFloat(r.amount) || 0, 'liabilities', r.id, r.amount, r.date)),
    ] },
  ].map((g) => ({ ...g, icon: NW_GROUP_ICON[g.key], expanded: state.expandedNwGroup === g.key }));

  const assets = cashTotalVal + investTotalVal + otherAssetsTotalVal;
  const liabilities = liabTotalVal;
  const netWorth = assets - liabilities;

  return { groups, assets, liabilities, netWorth };
}

// Real historical net worth, reconstructed from the dated rows/entries the
// user actually entered — never fabricated. Two dating mechanisms feed it:
//  - "Synced" seed rows (netWorthSeed.cash/creditCards) carry a full dated
//    delta history via the Add/Deduct-money modal (BalanceEntry[]); a row's
//    balance at date d is its current amount minus every entry dated after d.
//  - Manual rows (bank accounts, cards, properties, other assets,
//    liabilities) carry a single "as of" date (RecordRow.date, defaulting to
//    today) marking when the row started existing, plus the same dated
//    delta history as synced rows once the Add/Deduct-money dialog has been
//    used on them — the row contributes 0 before its "as of" date, and from
//    then on its balance at date d is its current amount minus every entry
//    dated after d (falling back to the flat current amount if it has no
//    history yet).
// Investments (seed and manual) have no per-date tracking — market value is
// inherently a "right now" number — so they contribute their current total
// at every point rather than being excluded from history entirely.
// A brand-new account has nothing dated yet, so this collapses to a single
// point at today with the current total — honest, not a fabricated trend.
function entryDate(d: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIso();
}

function seededHistoryRows(rows: RecordRow[]) {
  return rows.map((r) => {
    const current = parseFloat(r.amount) || 0;
    const entries = (r.history || []) as BalanceEntry[];
    const deltaSum = entries.reduce((s, e) => s + e.amount, 0);
    return { base: current - deltaSum, entries };
  });
}

function seedValueAt(rows: ReturnType<typeof seededHistoryRows>, date: string): number {
  return rows.reduce((sum, r) => {
    const applied = r.entries.filter((e) => entryDate(e.date) <= date).reduce((s, e) => s + e.amount, 0);
    return sum + r.base + applied;
  }, 0);
}

function manualValueAt(rows: RecordRow[], date: string): number {
  return rows.reduce((sum, r) => {
    const effDate = r.date || todayIso();
    if (date < effDate) return sum; // row didn't exist yet at this point
    const current = parseFloat(r.amount) || 0;
    const entries = (r.history || []) as BalanceEntry[];
    const deltaSum = entries.reduce((s, e) => s + e.amount, 0);
    const base = current - deltaSum;
    const applied = entries.filter((e) => entryDate(e.date) <= date).reduce((s, e) => s + e.amount, 0);
    return sum + base + applied;
  }, 0);
}

export function computeNetWorthTimeline(state: AppState): { date: string; value: number }[] {
  const cashSeed = seededHistoryRows(state.netWorthSeed.cash);
  const creditSeed = seededHistoryRows(state.netWorthSeed.creditCards);
  const cashManual = state.ob.manual.bankAccounts;
  const creditManual = state.ob.manual.creditCards;
  const otherManual = [...state.ob.manual.properties, ...state.ob.manual.otherAssets];
  const liabManual = state.ob.manual.liabilities;

  const investTotal =
    state.netWorthSeed.investments.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), 0) +
    state.ob.manual.investments.filter((r) => r.name).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), 0);

  const dates = new Set<string>([todayIso()]);
  [...cashSeed, ...creditSeed].forEach((r) => r.entries.forEach((e) => dates.add(entryDate(e.date))));
  [...cashManual, ...creditManual, ...otherManual, ...liabManual].forEach((r) => dates.add(r.date || todayIso()));

  return Array.from(dates).sort().map((date) => ({
    date,
    value:
      seedValueAt(cashSeed, date) + manualValueAt(cashManual, date) +
      investTotal +
      manualValueAt(otherManual, date) -
      seedValueAt(creditSeed, date) - manualValueAt(creditManual, date) -
      manualValueAt(liabManual, date),
  }));
}

const RANGE_DAYS: Record<AppState['netWorthRange'], number> = {
  '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 365 * 3, ALL: Infinity,
};
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function selectNetWorthChart(state: AppState) {
  const { netWorth } = selectNetWorth(state);
  const today = new Date();
  const windowDays = RANGE_DAYS[state.netWorthRange];
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const inWindow = Number.isFinite(windowDays)
    ? state.netWorthHistory.filter((h) => new Date(h.date) >= cutoff)
    : state.netWorthHistory;
  // Guard against an empty window (e.g. all real history predates the
  // selected range) by falling back to today's real current value rather
  // than rendering nothing.
  const points = inWindow.length > 0 ? inWindow : [{ date: today.toISOString().slice(0, 10), value: netWorth }];
  const series = points.map((p) => p.value);
  const seriesLabels = points.map((p) => shortDateLabel(p.date));
  const minV = Math.min(...series), maxV = Math.max(...series);
  const range = Math.max(1, maxV - minV);
  const pts = series.map((v, i) => {
    // series.length - 1 === 0 for a brand-new account's single real
    // snapshot — center that lone point instead of dividing by zero.
    const x = series.length > 1 ? (i / (series.length - 1)) * 292 + 4 : 150;
    const y = 118 - ((v - minV) / range) * 100;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as [number, number];
  });
  const linePoints = pts.map((p) => p.join(',')).join(' ');
  const areaPoints = pts.map((p) => p.join(',')).join(' ') + ' ' + pts[pts.length - 1][0] + ',128 ' + pts[0][0] + ',128';
  const delta = series[series.length - 1] - series[0];
  const deltaPct = series[0] !== 0 ? Number(((delta / series[0]) * 100).toFixed(1)) : 0;
  const selIdx = state.nwSelectedIdx != null && state.nwSelectedIdx < series.length ? state.nwSelectedIdx : null;
  const hasSelection = selIdx != null && !!seriesLabels;
  return {
    series, seriesLabels, minV, maxV, pts, linePoints, areaPoints, delta, deltaPct,
    hasSelection,
    selectedLabel: hasSelection ? seriesLabels![selIdx!] : '',
    selectedValueLabel: hasSelection ? moneyWhole(series[selIdx!]) : '',
    selCx: hasSelection ? pts[selIdx!][0] : 0,
    selCy: hasSelection ? pts[selIdx!][1] : 0,
    pointCount: pts.length,
  };
}

export function selectBudgets(state: AppState) {
  const now = new Date();
  const nowMonth = SHORT_MONTHS[now.getMonth()];
  const nowYear = now.getFullYear();
  const buckets = state.finance.buckets.map((b) => {
    const categories = b.categories.map((c: BudgetCategory) => {
      const itemsSpent = c.items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);
      // A category named after a real transaction category (Food & Drink,
      // Transport, ...) also counts this month's actual spending toward its
      // total -- not just manually-typed line items -- so scanning a
      // receipt or accepting a reviewed statement line moves the budget bar.
      // Custom categories (Housing, Emergency fund, ...) have no matching
      // transaction category and stay purely manual, same as before.
      // Matching on t.month alone (a bare "Aug") would double-count every
      // August from every year a transaction has ever been dated in as
      // "this month" -- deriveTxDate's real year is what actually scopes
      // this to the current month AND year, not just the current month name.
      const txSpent = CAT_ICON[c.name]
        ? state.transactions
            .filter((t) => t.cat === c.name && t.amount < 0 && deriveTxDate(t).month === nowMonth && deriveTxDate(t).year === nowYear)
            .reduce((s, t) => s + Math.abs(t.amount), 0)
        : 0;
      const spent = itemsSpent + txSpent;
      const total = c.cap;
      const pct = state.mounted && total > 0 ? Math.round((spent / total) * 100) : 0;
      const over = spent > total;
      const met = b.key === 'goals' && total > 0 && spent >= total;
      // "Over budget" and "X% used" are no longer separate notes here --
      // BudgetUtilisationBar shows utilisation (including overspend) inline
      // on every row now, so a second line repeating the same number was
      // redundant. "Goal reached" stays: it's information the bar doesn't
      // carry (a goals-bucket category met, not just spent-vs-cap).
      let note: string | null = null, noteColor = 'var(--color-text-muted)';
      if (met) { note = 'Goal reached'; noteColor = 'var(--color-accent-700)'; }
      // pct is the TRUE utilisation (can exceed 100 when over budget) -- the
      // only clamped value is barPct, used solely for CSS width, so a bar
      // can never render wider than its track. Never clamp the number shown
      // to the user; that silently hides overspend (was RM1,200/RM1,000 ->
      // "100%" instead of the real 120%).
      return { id: c.id, name: c.name, spent, total, spentLabel: moneyWhole(spent), totalLabel: moneyWhole(total), pct, barPct: Math.min(pct, 100), over, note, noteColor, detailKey: b.key + ':' + c.id, items: c.items };
    });
    const spent = categories.reduce((s, c) => s + c.spent, 0);
    const total = categories.reduce((s, c) => s + c.total, 0);
    const pct = state.mounted && total > 0 ? Math.round((spent / total) * 100) : 0;
    return { key: b.key, name: b.name, spent, total, spentLabel: moneyWhole(spent), totalLabel: moneyWhole(total), pct, barPct: Math.min(pct, 100), over: spent > total, expanded: state.expandedBucket === b.key, categories };
  });
  const totalSpent = buckets.reduce((s, b) => s + b.spent, 0);
  const totalPlan = buckets.reduce((s, b) => s + b.total, 0);
  return { buckets, totalSpent, totalPlan };
}

const BUDGET_SHADES = ['var(--color-accent-700)', 'var(--color-accent-500)', 'var(--color-accent-300)', 'var(--color-neutral-500)'];

export interface DonutBranch {
  bucketKey: string; catId: string; name: string; amountLabel: string; color: string; pct: number;
  x1: string; y1: string; x2: string; y2: string; calloutLeft: string; calloutTop: string;
}

// Ported from Cukai v7.dc.html lines 2790-2836: the half-donut budget gauge
// at the top of the Budgets screen, with an expandable per-category
// breakdown (donutBranches) when state.donutExpanded is true.
export function selectBudgetGauge(state: AppState) {
  const { buckets, totalSpent: budgetTotalSpent, totalPlan: budgetTotalPlan } = selectBudgets(state);
  const gaugeCX = 150, gaugeCY = 210, gaugeR = 110;
  const gaugePctSpent = state.mounted && budgetTotalPlan > 0 ? Math.min(1, budgetTotalSpent / budgetTotalPlan) : 0;
  const gaugePoint = (f: number): [number, number] => {
    const theta = ((180 - f * 180) * Math.PI) / 180;
    return [gaugeCX + gaugeR * Math.cos(theta), gaugeCY - gaugeR * Math.sin(theta)];
  };
  const fmt = (p: [number, number]) => p[0].toFixed(2) + ' ' + p[1].toFixed(2);
  const gaugeStart = gaugePoint(0), gaugeMid = gaugePoint(gaugePctSpent), gaugeEnd = gaugePoint(1);
  // Full track is always the light "available" green; spentArcPath overlays
  // just the utilised portion (start -> mid) in the dark "spent" green (or
  // danger red once overspent), so the two colours map directly onto their
  // meaning instead of relying on an unlabelled grey backdrop.
  const gaugeArcPath = `M ${fmt(gaugeStart)} A ${gaugeR} ${gaugeR} 0 0 1 ${fmt(gaugeEnd)}`;
  const spentArcPath = `M ${fmt(gaugeStart)} A ${gaugeR} ${gaugeR} 0 0 1 ${fmt(gaugeMid)}`;
  // True, uncapped utilisation for the badge riding the arc boundary --
  // gaugePctSpent above is clamped to 1 because the arc geometry itself
  // cannot physically extend past a full circle, but the number shown in
  // the badge must still read e.g. "112%" on an overspent month rather than
  // silently reporting back "100%".
  const gaugeSpentPct = state.mounted && budgetTotalPlan > 0 ? Math.round((budgetTotalSpent / budgetTotalPlan) * 100) : 0;
  const gaugeOverspent = budgetTotalSpent > budgetTotalPlan;

  const budgetRemaining = Math.max(0, budgetTotalPlan - budgetTotalSpent);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);

  let donutBranches: DonutBranch[] = [];
  if (state.donutExpanded) {
    const allCats: { bucketKey: string; catId: string; name: string; spent: number; color: string }[] = [];
    buckets.forEach((b, bi) => b.categories.forEach((c) =>
      allCats.push({ bucketKey: b.key, catId: c.id, name: c.name, spent: c.spent, color: BUDGET_SHADES[bi % BUDGET_SHADES.length] })));
    allCats.sort((a, b) => b.spent - a.spent);
    const topCats = allCats.slice(0, 5);
    const N = topCats.length, lineStartR = gaugeR + 12, lineEndR = gaugeR + 32, calloutR = gaugeR + 40;
    // Anchor the callouts to the utilised (spent) span of the arc only --
    // gaugePoint(f) uses theta = 180 - f*180, which is -angle in this
    // branch formula's own cos/sin convention, so f=0..gaugePctSpent maps
    // to angle = 180..180+gaugePctSpent*180. Padding keeps branches off the
    // exact RM0 / spend-boundary edges; it shrinks with a thin spent span
    // so branches never spill into the untouched "available" arc.
    const spentSpanDeg = Math.max(0, gaugePctSpent * 180);
    const pad = Math.min(20, spentSpanDeg * 0.15);
    const angleStart = 180 + pad, angleEnd = 180 + spentSpanDeg - pad;
    const singleAngle = 180 + spentSpanDeg / 2;
    donutBranches = topCats.map((c, i) => {
      const angleDeg = N > 1 && angleEnd > angleStart ? angleStart + ((angleEnd - angleStart) * i) / (N - 1) : singleAngle;
      const angle = (angleDeg * Math.PI) / 180;
      const ex = gaugeCX + calloutR * Math.cos(angle), ey = gaugeCY + calloutR * Math.sin(angle);
      const sx = gaugeCX + lineStartR * Math.cos(angle), sy = gaugeCY + lineStartR * Math.sin(angle);
      const tx = gaugeCX + lineEndR * Math.cos(angle), ty = gaugeCY + lineEndR * Math.sin(angle);
      return {
        bucketKey: c.bucketKey, catId: c.catId, name: c.name, amountLabel: moneyWhole(c.spent), color: c.color,
        pct: budgetTotalSpent > 0 ? Math.round((c.spent / budgetTotalSpent) * 100) : 0,
        x1: sx.toFixed(1), y1: sy.toFixed(1), x2: tx.toFixed(1), y2: ty.toFixed(1),
        calloutLeft: ex.toFixed(1) + 'px', calloutTop: ey.toFixed(1) + 'px',
      };
    });
  }

  return {
    gaugeArcPath, spentArcPath, donutBranches,
    gaugeMidX: gaugeMid[0], gaugeMidY: gaugeMid[1], gaugeSpentPct, gaugeOverspent,
    donutHint: state.donutExpanded ? 'Tap to collapse' : 'Tap for a category breakdown',
    gaugeBoxHeight: state.donutExpanded ? 280 : 178,
    gaugeShiftY: state.donutExpanded ? 0 : -64,
    gaugeOverflow: state.donutExpanded ? 'visible' : 'hidden',
    budgetRemainingLabel: moneyWhole(budgetRemaining),
    budgetPerDayLabel: moneyWhole(budgetRemaining / daysLeft),
    budgetSpentTotalLabel: moneyWhole(budgetTotalSpent),
    budgetPlanTotalLabel: moneyWhole(budgetTotalPlan),
  };
}

export function selectHomeDashboard(state: AppState) {
  const { totalSpent: homeBudgetSpent, totalPlan: homeBudgetTotal } = selectBudgets(state);
  const homeBudgetPct = state.mounted && homeBudgetTotal > 0 ? Math.round((homeBudgetSpent / homeBudgetTotal) * 100) : 0;

  const isPremiumHome = state.subscriptionTier === 'premium';
  const homeLifeMeta = TAX_ITEMS_META.lifestyle.find((i) => i.key === 'life_general')!;
  const homeLifeData = buildCapturedData(state.transactions, state.taxYear).life_general || { captured: 0, receipts: [] };
  const homeLifePct = homeLifeMeta ? Math.round((homeLifeData.captured / homeLifeMeta.cap) * 100) : 0;
  const insight = homeLifePct >= 85
    ? { title: 'Lifestyle relief ' + homeLifePct + '% used', sub: 'RM ' + moneyWhole(homeLifeMeta.cap - homeLifeData.captured) + ' of your RM ' + moneyWhole(homeLifeMeta.cap) + ' cap left this year — tap to review in Tax Center →' }
    : { title: "You're pacing well this month", sub: 'RM ' + moneyWhole(homeBudgetTotal - homeBudgetSpent) + ' under budget · tap to review in Tax Center →' };

  const budgetDerivedTx: Transaction[] = [];
  state.finance.buckets.forEach((b) => b.categories.forEach((c) => c.items.forEach((it) => {
    if (!it.name) return;
    const cat = CAT_ICON[c.name] ? c.name : b.key === 'insurance' ? 'Insurance' : b.key === 'goals' ? 'Lifestyle' : 'Bills';
    budgetDerivedTx.push({ id: 'bud-' + it.id, merchant: it.name, cat, dateLabel: 'Recurring', dateGroup: 'This week', month: SHORT_MONTHS[new Date().getMonth()], amount: -(parseFloat(String(it.amount)) || 0), tax: false, payment: b.name + ' budget' });
  })));
  const combinedTx = state.transactions.concat(budgetDerivedTx);

  const recentTx = combinedTx.filter((t) => t.dateGroup === 'Today' || t.dateGroup === 'Yesterday').slice(0, 3).map((t) => ({
    ...t, ...rowBadge(t), catLabel: t.cat,
    amountLabel: (t.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(t.amount)),
    amountColor: t.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
  }));

  return { homeBudgetSpent, homeBudgetTotal, homeBudgetPct, isPremiumHome, insight, recentTx, combinedTx };
}

export function selectReviewFlow(state: AppState) {
  const items = state.pendingReviewItems;
  const reviewCount = items.filter((i) => !state.reviewDecisions[i.id]).length;
  const reviewPreview = items.filter((i) => !state.reviewDecisions[i.id] && Math.abs(i.amount) > 50).slice(0, 2);
  const pending = items.filter((i) => !state.reviewDecisions[i.id]);
  const curItem = pending[0] || null;
  const nextItem = pending[1] || null;
  const dragX = state.reviewDragging ? state.reviewDragX : 0;
  return {
    reviewCount, reviewPreview, curItem, nextItem,
    dragX, rotate: (dragX / 14).toFixed(1),
    acceptOpacity: clamp(dragX / 90, 0, 1), rejectOpacity: clamp(-dragX / 90, 0, 1),
  };
}

export function selectTaxCenter(state: AppState) {
  const ob = state.ob;
  const profile: TaxProfile = { marital: ob.marital, dependants: ob.dependants, reliefs: ob.reliefs, hasDisability: ob.hasDisability, hasHousingLoan: ob.hasHousingLoan };
  const grossAnnualIncome = estimateAnnualIncome(ob.approxIncome || ob.income);
  const capturedData = buildCapturedData(state.transactions, state.taxYear);
  const rawTaxModel = buildTaxModel(profile, capturedData);
  // totalCaptured already includes the RM 9,000 automatic "Individual &
  // Dependent Relatives" relief (indiv_self, automatic:true), so it must not
  // be subtracted a second time as a literal here.
  const chargeableIncomeEst = Math.max(0, grossAnnualIncome - rawTaxModel.totalCaptured);
  const incomeKnown = grossAnnualIncome > 0;
  const marginalRate = incomeKnown ? marginalTaxRate(chargeableIncomeEst) : ASSUMED_TAX_RATE;
  const taxBracketPct = Math.round(marginalRate * 100);
  const taxModel = buildTaxModel(profile, capturedData, marginalRate);
  const prevTaxYear = 'YA' + (parseInt(state.taxYear.replace(/^YA/, ''), 10) - 1);
  const prevCapturedData = buildCapturedData(state.transactions, prevTaxYear);
  const prevTaxModel = buildTaxModel(profile, prevCapturedData, marginalRate);
  const { totalCaptured, totalCap, totalRemaining: totalAvailable, totalPotentialBenefit } = taxModel;

  const taxOptPct = state.mounted && totalCap > 0 ? Math.round((totalCaptured / totalCap) * 100) : 0;
  const benchmarkLastShare = state.mounted && totalCaptured > 0 ? Math.round((prevTaxModel.totalCaptured / totalCaptured) * 100) : 0;
  const taxDeltaPct = prevTaxModel.totalCaptured > 0 ? Math.round(((totalCaptured - prevTaxModel.totalCaptured) / prevTaxModel.totalCaptured) * 100) : 0;
  const hasReliefProfile = ob.reliefs.length > 0;
  const reliefProfileSummary = ob.reliefs.slice(0, 3).join(', ') + (ob.reliefs.length > 3 ? ' and more' : '');

  const visibleGroups = taxModel.groups.filter((g) => g.items.length > 0);
  const taxReceiptsAll = taxModel.allReceipts;
  const taxReceiptsVisible = taxReceiptsAll.slice(0, 4);

  let taxItemDetail: { item: (typeof taxModel.groups)[number]['items'][number]; groupName: string } | null = null;
  if (state.taxItemDetailOpen) {
    const sepIdx = state.taxItemDetailOpen.indexOf(':');
    const tgKey = state.taxItemDetailOpen.slice(0, sepIdx), tiKey = state.taxItemDetailOpen.slice(sepIdx + 1);
    const grp = visibleGroups.find((g) => g.key === tgKey);
    const item = grp?.items.find((it) => it.key === tiKey);
    if (grp && item) taxItemDetail = { item, groupName: grp.label };
  }

  return {
    grossAnnualIncome, taxBracketPct, taxModel, prevTaxModel, totalCaptured, totalCap, totalAvailable,
    totalPotentialBenefit, taxOptPct, groups: visibleGroups, taxReceiptsAll, taxReceiptsVisible,
    taxReceiptsHasMore: taxReceiptsAll.length > 4, taxItemDetail, benchmarkLastShare, taxDeltaPct,
    hasReliefProfile, reliefProfileSummary, incomeKnown, chargeableIncomeEst,
  };
}

export function selectReceiptReview(state: AppState) {
  const lineItemsTotal = state.lineItemDrafts.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const printedTotal = parseFloat(state.receiptDraft.total) || 0;
  const mismatchAmount = Math.round((printedTotal - lineItemsTotal) * 100) / 100;
  const hasMismatch = printedTotal > 0 && Math.abs(mismatchAmount) > 0.01;
  const hasFlaggedItems = state.lineItemDrafts.some((it) => lineItemIsInvalid(it) || lineItemNeedsReview(it));
  const canSaveDetailed = state.lineItemDrafts.length > 0 && !hasFlaggedItems;
  return { lineItemsTotal, mismatchAmount, hasMismatch, hasFlaggedItems, canSaveDetailed };
}

export function selectRecordPage(state: AppState) {
  const { combinedTx } = selectHomeDashboard(state);

  const rangeTxRaw = combinedTx.filter((t) => {
    const iso = txDateIso(t);
    if (iso < state.recordDateFrom || iso > state.recordDateTo) return false;
    if (state.txFilter !== 'All' && t.cat !== state.txFilter) return false;
    if (state.txSearch && !t.merchant.toLowerCase().includes(state.txSearch.toLowerCase())) return false;
    return true;
  });

  const rangeTx = rangeTxRaw.map((t) => ({
    ...t, ...rowBadge(t), catLabel: t.cat,
    amountLabel: (t.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(t.amount)),
    amountColor: t.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
  }));

  const sorted = rangeTx.slice().sort((a, b) => {
    const ai = txDateIso(a), bi = txDateIso(b);
    return ai < bi ? 1 : ai > bi ? -1 : 0;
  });

  const groupedTx: { label: string; iso: string; items: typeof sorted }[] = [];
  sorted.forEach((t) => {
    const iso = txDateIso(t);
    const lastGroup = groupedTx[groupedTx.length - 1];
    if (lastGroup && lastGroup.iso === iso) { lastGroup.items.push(t); return; }
    groupedTx.push({ label: isoToGroupLabel(iso), iso, items: [t] });
  });

  const rangeIncome = rangeTxRaw.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const rangeExpense = rangeTxRaw.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const rangeNet = rangeIncome - rangeExpense;

  // Every category actually present in the data, not a fixed curated list
  // (which used to be CAT_ICON's keys -- an incidental subset that only
  // ever covered categories with a hand-drawn SVG icon, silently excluding
  // 'Other' and, since the Essential/Lifestyle taxonomy expansion, most of
  // the real category list). This is also naturally self-updating: any
  // future category, or a legacy one from before this taxonomy change,
  // shows up automatically as soon as a transaction actually uses it.
  const categoryChips = ['All', ...Array.from(new Set(combinedTx.map((t) => t.cat))).sort()];

  return { groupedTx, rangeCount: rangeTxRaw.length, rangeNet, categoryChips };
}

export function selectStatsPage(state: AppState) {
  const statsPeriodOptions = ['This month', 'Last 3 months', 'This year', 'Choose month'];
  const historyIdx = MONTH_ORDER.indexOf(state.historyMonth);
  // Every period is a set of {month, year} pairs, not bare month names --
  // "Aug" alone would match Aug of every year the account has history for.
  const statsPeriods: { month: string; year: number }[] =
    state.statsPeriod === 'This year'
      ? MONTH_ORDER.map((m) => ({ month: m, year: state.historyYear }))
      : state.statsPeriod === 'Last 3 months'
      ? [0, 1, 2].map((back) => {
          const total = historyIdx - back;
          const year = state.historyYear + Math.floor(total / 12);
          const mIdx = ((total % 12) + 12) % 12;
          return { month: MONTH_ORDER[mIdx], year };
        })
      : [{ month: state.historyMonth, year: state.historyYear }]; // 'This month' / 'Choose month'
  const { combinedTx } = selectHomeDashboard(state);
  const statsTx = combinedTx.filter((t) => {
    if (t.amount >= 0) return false;
    const d = deriveTxDate(t);
    return statsPeriods.some((p) => p.month === d.month && p.year === d.year);
  });
  const statsCatTotals: Record<string, number> = {};
  statsTx.forEach((t) => { statsCatTotals[t.cat] = (statsCatTotals[t.cat] || 0) + Math.abs(t.amount); });
  const statsCatSum = Object.values(statsCatTotals).reduce((s, v) => s + v, 0);
  const statsCategoryBars = Object.entries(statsCatTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
    const pct = statsCatSum > 0 ? Math.round((amt / statsCatSum) * 100) : 0;
    const color = CAT_COLOR[cat] || 'var(--color-neutral-500)';
    return { name: cat, amount: amt, amountLabel: moneyWhole(amt), pct, color };
  });
  const statsCategoryDetailTxRaw = state.statsCategoryDetail ? statsTx.filter((t) => t.cat === state.statsCategoryDetail) : [];
  const statsCategoryDetailTx = statsCategoryDetailTxRaw.map((t) => ({
    ...t, ...rowBadge(t), amountLabel: '−RM ' + money(Math.abs(t.amount)), amountColor: 'var(--color-text)',
  }));
  return {
    statsPeriodOptions, statsCategoryBars, statsCategorySumLabel: moneyWhole(statsCatSum),
    statsCategoryDetailTx, statsCategoryDetailTotal: moneyWhole(statsCategoryDetailTxRaw.reduce((s, t) => s + Math.abs(t.amount), 0)),
  };
}

export function selectSubscriptions(state: AppState) {
  const FREQ_MONTHLY_FACTOR: Record<string, number> = { Monthly: 1, Weekly: 4.33, Yearly: 1 / 12, Quarterly: 1 / 3 };
  const subs = state.ob.subs;
  const monthlyTotal = subs.reduce((s, x) => s + (parseFloat(x.amount) || 0) * (FREQ_MONTHLY_FACTOR[x.frequency] || 1), 0);
  return { subs, monthlyTotal, yearlyLabel: moneyWhole(monthlyTotal * 12) };
}

// A compact, real-data-only snapshot sent alongside every AI chat message so
// Gemini can answer questions about "my net worth" / "my budget" grounded in
// what the user actually entered, instead of guessing plausible-sounding
// numbers — the AI screen tells the user "I can see your accounts, budgets,
// receipts and tax profile", so it actually needs to. Deliberately small
// (a handful of totals, not full transaction/row dumps) to keep free-tier
// token use down; every figure here is a real computed value, never invented.
export function selectAiContext(state: AppState) {
  const nw = selectNetWorth(state);
  const chart = selectNetWorthChart(state);
  const { buckets, totalSpent, totalPlan } = selectBudgets(state);
  const tax = selectTaxCenter(state);
  const { subs, monthlyTotal } = selectSubscriptions(state);

  return {
    netWorth: {
      total: Math.round(nw.netWorth), assets: Math.round(nw.assets), liabilities: Math.round(nw.liabilities),
      changeOverSelectedRange: Math.round(chart.delta), changePct: chart.deltaPct,
    },
    budget: {
      totalSpentThisMonth: Math.round(totalSpent), totalPlannedThisMonth: Math.round(totalPlan),
      categories: buckets.flatMap((b) => b.categories.map((c) => ({ name: c.name, spent: Math.round(c.spent), cap: Math.round(c.total) }))),
    },
    tax: {
      taxYear: state.taxYear, grossAnnualIncomeEstimate: Math.round(tax.grossAnnualIncome), marginalTaxBracketPct: tax.taxBracketPct,
      reliefsCapturedRM: Math.round(tax.totalCaptured), reliefsCapRM: Math.round(tax.totalCap),
    },
    subscriptions: { count: subs.length, monthlyTotalRM: Math.round(monthlyTotal) },
    profile: {
      maritalStatus: state.ob.marital, dependants: state.ob.dependants,
      employmentStatus: state.ob.employment, taxResidency: state.ob.residency,
    },
    // Real scanned/reviewed receipts only (state.transactions) — not the
    // budget-derived synthetic rows selectHomeDashboard overlays for display.
    recentReceipts: state.transactions.slice(-10).map((t) => ({
      merchant: t.merchant, amount: Math.round(t.amount), category: t.cat, date: t.dateLabel, taxDeductible: t.tax,
    })),
  };
}
