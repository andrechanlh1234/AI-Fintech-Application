// Derived/computed view-model selectors ported from Cukai v7.dc.html's
// renderVals() (lines 2345-2790). Pure functions of AppState — no dispatch,
// no bound handlers. Screens read data from these and bind interactions via
// useActions() directly (e.g. onClick={() => actions.openBalanceDetail(...)}).
import type { AppState } from './types';
import { money, moneyWhole, clamp } from '../lib/format';
import {
  ALL_TX, MONTH_SUMMARIES, REVIEW_ITEMS, NETWORTH_SERIES, NETWORTH_1M,
  type Transaction, type BudgetCategory,
} from '../lib/seedData';
import { CAT_ICON, CAT_COLOR, NW_GROUP_ICON, rowBadge, deriveTxDate, NETWORTH_MONTH_LABELS, MONTH_ORDER } from '../lib/constants';
import {
  buildTaxModel, estimateAnnualIncome, marginalTaxRate, ASSUMED_TAX_RATE,
  TAX_ITEMS_META, TAX_ITEM_DATA, RELIEF_INFO, type TaxProfile,
} from '../lib/taxEngine';

function sumOb(state: AppState, listKey: 'bankAccounts' | 'creditCards' | 'properties' | 'otherAssets' | 'liabilities') {
  return state.ob.manual[listKey].reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
}

export interface NwRow {
  name: string; subLabel: string; balanceValue: number; brand?: string | null;
  clickable: boolean; listKey: string; id: string | null;
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

  const nwEditRow = (name: string, amount: number, subLabel: string, listKey: string, id: string, brand?: string | null): NwRow =>
    ({ name, subLabel, balanceValue: amount, brand, clickable: !!(listKey && id), listKey, id });
  const nwInvestRow = (r: { name: string; qty: string; cur: string; id: string; brand?: string | null }, listKey: string): NwRow =>
    ({ name: r.name, subLabel: 'Tap to edit', balanceValue: (parseFloat(r.qty) || 0) * (parseFloat(r.cur) || 0), brand: r.brand, clickable: !!r.id, listKey, id: r.id });

  const groups = [
    { key: 'cash', label: 'Cash', totalVal: cashTotalVal, rows: [
      ...state.netWorthSeed.cash.map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Synced · tap to edit', 'seed.cash', r.id, r.brand)),
      ...ob.manual.bankAccounts.filter((r) => r.name).map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Manual · tap to view history', 'bankAccounts', r.id)),
    ] },
    { key: 'invest', label: 'Investments', totalVal: investTotalVal, rows: [
      ...state.netWorthSeed.investments.map((r) => nwInvestRow(r, 'seed.investments')),
      ...ob.manual.investments.filter((r) => r.name).map((r, i) => nwInvestRow({ ...r, id: r.id || 'mi' + i }, 'investments')),
    ] },
    { key: 'other', label: 'Other assets', totalVal: otherAssetsTotalVal, rows: [
      ...ob.manual.properties.filter((r) => r.name).map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Manual · tap to view history', 'properties', r.id)),
      ...ob.manual.otherAssets.filter((r) => r.name).map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Manual · tap to view history', 'otherAssets', r.id)),
    ] },
    { key: 'liab', label: 'Liabilities', totalVal: liabTotalVal, rows: [
      ...state.netWorthSeed.creditCards.map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Synced · tap to edit', 'seed.creditCards', r.id, r.brand)),
      ...ob.manual.creditCards.filter((r) => r.name).map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Manual · tap to view history', 'creditCards', r.id)),
      ...ob.manual.liabilities.filter((r) => r.name).map((r) => nwEditRow(r.name, parseFloat(r.amount) || 0, 'Manual · tap to view history', 'liabilities', r.id)),
    ] },
  ].map((g) => ({ ...g, icon: NW_GROUP_ICON[g.key], expanded: state.expandedNwGroup === g.key }));

  const assets = cashTotalVal + investTotalVal + otherAssetsTotalVal;
  const liabilities = liabTotalVal;
  const netWorth = assets - liabilities;

  return { groups, assets, liabilities, netWorth };
}

export function selectNetWorthChart(state: AppState) {
  const rangeSlice = (n: number) => ({ series: NETWORTH_SERIES.slice(-n), labels: NETWORTH_MONTH_LABELS.slice(-n) });
  const chartData = state.netWorthRange === '1M' ? { series: NETWORTH_1M, labels: null as string[] | null }
    : state.netWorthRange === '3M' ? rangeSlice(3)
    : state.netWorthRange === '6M' ? rangeSlice(6)
    : state.netWorthRange === '1Y' ? rangeSlice(12)
    : { series: NETWORTH_SERIES, labels: NETWORTH_MONTH_LABELS };
  const series = chartData.series, seriesLabels = chartData.labels;
  const minV = Math.min(...series), maxV = Math.max(...series);
  const range = Math.max(1, maxV - minV);
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * 292 + 4;
    const y = 118 - ((v - minV) / range) * 100;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as [number, number];
  });
  const linePoints = pts.map((p) => p.join(',')).join(' ');
  const areaPoints = pts.map((p) => p.join(',')).join(' ') + ' ' + pts[pts.length - 1][0] + ',128 ' + pts[0][0] + ',128';
  const delta = series[series.length - 1] - series[0];
  const deltaPct = Number(((delta / series[0]) * 100).toFixed(1));
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
  const buckets = state.finance.buckets.map((b) => {
    const categories = b.categories.map((c: BudgetCategory) => {
      const spent = c.items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);
      const total = c.cap;
      const pct = state.mounted && total > 0 ? Math.round((spent / total) * 100) : 0;
      const over = spent > total;
      const met = b.key === 'goals' && total > 0 && spent >= total;
      let note: string | null = null, noteColor = 'var(--color-text-muted)';
      if (over) { note = 'Over budget by RM ' + moneyWhole(spent - total); noteColor = 'var(--color-danger-700)'; }
      else if (met) { note = 'Goal reached'; noteColor = 'var(--color-accent-700)'; }
      else if (pct >= 90) { note = pct + '% used'; }
      return { id: c.id, name: c.name, spent, total, spentLabel: moneyWhole(spent), totalLabel: moneyWhole(total), pct: Math.min(pct, 100), barColor: over ? 'var(--color-danger)' : 'var(--color-accent)', note, noteColor, detailKey: b.key + ':' + c.id, items: c.items };
    });
    const spent = categories.reduce((s, c) => s + c.spent, 0);
    const total = categories.reduce((s, c) => s + c.total, 0);
    const pct = state.mounted && total > 0 ? Math.round((spent / total) * 100) : 0;
    return { key: b.key, name: b.name, spent, total, spentLabel: moneyWhole(spent), totalLabel: moneyWhole(total), pct, expanded: state.expandedBucket === b.key, categories };
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
  const gaugeArcPath = `M ${fmt(gaugeStart)} A ${gaugeR} ${gaugeR} 0 0 1 ${fmt(gaugeEnd)}`;
  const availableArcPath = `M ${fmt(gaugeMid)} A ${gaugeR} ${gaugeR} 0 0 1 ${fmt(gaugeEnd)}`;

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
    const angleStart = 200, angleEnd = 340;
    donutBranches = topCats.map((c, i) => {
      const angleDeg = N > 1 ? angleStart + ((angleEnd - angleStart) * i) / (N - 1) : 270;
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
    gaugeArcPath, availableArcPath, donutBranches,
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
  const homeLifeData = (TAX_ITEM_DATA[state.taxYear] || {}).life_general || { captured: 0, receipts: [] };
  const homeLifePct = homeLifeMeta ? Math.round((homeLifeData.captured / homeLifeMeta.cap) * 100) : 0;
  const insight = homeLifePct >= 85
    ? { title: 'Lifestyle relief ' + homeLifePct + '% used', sub: 'RM ' + moneyWhole(homeLifeMeta.cap - homeLifeData.captured) + ' of your RM ' + moneyWhole(homeLifeMeta.cap) + ' cap left this year — tap to review in Tax Center →' }
    : { title: "You're pacing well this month", sub: 'RM ' + moneyWhole(homeBudgetTotal - homeBudgetSpent) + ' under budget · tap to review in Tax Center →' };

  const budgetDerivedTx: Transaction[] = [];
  state.finance.buckets.forEach((b) => b.categories.forEach((c) => c.items.forEach((it) => {
    if (!it.name) return;
    const cat = CAT_ICON[c.name] ? c.name : b.key === 'insurance' ? 'Health' : b.key === 'goals' ? 'Lifestyle' : 'Bills';
    budgetDerivedTx.push({ id: 'bud-' + it.id, merchant: it.name, cat, dateLabel: 'Recurring', dateGroup: 'This week', month: 'Aug', amount: -(parseFloat(String(it.amount)) || 0), tax: false, payment: b.name + ' budget' });
  })));
  const combinedTx = ALL_TX.concat(budgetDerivedTx);

  const recentTx = combinedTx.filter((t) => t.dateGroup === 'Today' || t.dateGroup === 'Yesterday').slice(0, 3).map((t) => ({
    ...t, ...rowBadge(t), catLabel: t.cat,
    amountLabel: (t.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(t.amount)),
    amountColor: t.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
  }));

  return { homeBudgetSpent, homeBudgetTotal, homeBudgetPct, isPremiumHome, insight, recentTx, combinedTx };
}

export function selectReviewFlow(state: AppState) {
  const reviewCount = REVIEW_ITEMS.filter((i) => !state.reviewDecisions[i.id]).length;
  const reviewPreview = REVIEW_ITEMS.filter((i) => !state.reviewDecisions[i.id] && i.amount > 50).slice(0, 2);
  const pending = REVIEW_ITEMS.filter((i) => !state.reviewDecisions[i.id]);
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
  const rawTaxModel = buildTaxModel(state.taxYear, profile);
  const chargeableIncomeEst = Math.max(0, grossAnnualIncome - 9000 - rawTaxModel.totalCaptured);
  const marginalRate = grossAnnualIncome > 0 ? marginalTaxRate(chargeableIncomeEst) : ASSUMED_TAX_RATE;
  const taxBracketPct = Math.round(marginalRate * 100);
  const taxModel = buildTaxModel(state.taxYear, profile, marginalRate);
  const prevTaxYear = state.taxYear === 'YA2026' ? 'YA2025' : 'YA2026';
  const prevTaxModel = buildTaxModel(prevTaxYear, profile, marginalRate);
  const { totalCaptured, totalCap, totalRemaining: totalAvailable, totalPotentialBenefit } = taxModel;

  const taxOptPct = state.mounted && totalCap > 0 ? Math.round((totalCaptured / totalCap) * 100) : 0;
  const benchmarkLastShare = state.mounted && totalCaptured > 0 ? Math.round((prevTaxModel.totalCaptured / totalCaptured) * 100) : 0;
  const taxDeltaPct = prevTaxModel.totalCaptured > 0 ? Math.round(((totalCaptured - prevTaxModel.totalCaptured) / prevTaxModel.totalCaptured) * 100) : 0;
  const hasReliefProfile = ob.reliefs.length > 0;
  const reliefProfileSummary = ob.reliefs.slice(0, 3).join(', ') + (ob.reliefs.length > 3 ? ' and more' : '');

  const visibleGroups = taxModel.groups.filter((g) => g.items.length > 0);
  const taxReceiptsAll = taxModel.allReceipts;
  const taxReceiptsVisible = state.showAllTaxReceipts ? taxReceiptsAll : taxReceiptsAll.slice(0, 4);

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
    hasReliefProfile, reliefProfileSummary,
  };
}

export function selectReliefImpact(state: AppState) {
  const scanAmountNum = parseFloat(state.scanAmount) || 0;
  const reliefInfo = RELIEF_INFO[state.scanCategory] || null;
  if (!reliefInfo) return { hasReliefInfo: false as const };
  const beforePct = state.mounted ? Math.min(100, Math.round((reliefInfo.before / reliefInfo.cap) * 100)) : 0;
  const after = Math.min(reliefInfo.cap, reliefInfo.before + scanAmountNum);
  const afterPct = state.mounted ? Math.min(100, Math.round((after / reliefInfo.cap) * 100)) : 0;
  return {
    hasReliefInfo: true as const, name: reliefInfo.name, why: reliefInfo.why,
    beforePct, afterPct, remainingLabel: moneyWhole(Math.max(0, reliefInfo.cap - after)),
    beforeLabel: moneyWhole(reliefInfo.before), afterLabel: moneyWhole(after), capLabel: moneyWhole(reliefInfo.cap),
  };
}

export function selectRecordPage(state: AppState) {
  const { combinedTx } = selectHomeDashboard(state);
  const expenseDayKeys = new Set<string>();
  combinedTx.forEach((t) => { if (t.amount < 0) { const d = deriveTxDate(t); expenseDayKeys.add(d.month + '-' + d.day); } });
  const CAL_SPANS = [{ name: 'Aug', mIdx: 7, days: 31 }, { name: 'Sep', mIdx: 8, days: 15 }];
  const calendarDays: { key: string; day: number; month: string; weekday: string; isToday: boolean; isSelected: boolean; hasExpense: boolean }[] = [];
  CAL_SPANS.forEach((cm) => {
    for (let d = 1; d <= cm.days; d++) {
      const weekday = new Date(2026, cm.mIdx, d).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
      const key = cm.name + '-' + d;
      calendarDays.push({
        key, day: d, month: cm.name, weekday,
        isToday: cm.name === 'Aug' && d === 15,
        isSelected: cm.name === state.selectedDayMonth && d === state.selectedDay,
        hasExpense: expenseDayKeys.has(key),
      });
    }
  });
  const selectedDayTxRaw = combinedTx.filter((t) => { const d = deriveTxDate(t); return d.month === state.selectedDayMonth && d.day === state.selectedDay; });
  const selectedDayTx = selectedDayTxRaw.map((t) => ({
    ...t, ...rowBadge(t), catLabel: t.cat,
    amountLabel: (t.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(t.amount)),
    amountColor: t.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
  }));
  const selectedDayIncome = selectedDayTxRaw.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const selectedDayExpense = selectedDayTxRaw.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const selectedDayNet = selectedDayIncome - selectedDayExpense;
  const selectedDayLabel = new Date(2026, state.selectedDayMonth === 'Aug' ? 7 : 8, state.selectedDay)
    .toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const categoryChips = ['All', ...Object.keys(CAT_ICON)];
  const filteredTx = combinedTx.filter((t) => {
    if (state.txFilter !== 'All' && t.cat !== state.txFilter) return false;
    if (state.txSearch && !t.merchant.toLowerCase().includes(state.txSearch.toLowerCase())) return false;
    return true;
  });

  return {
    recordMonthLabel: 'August 2026', calendarDays, selectedDayTx, selectedDayIncome, selectedDayExpense,
    selectedDayNet, selectedDayLabel, categoryChips, filteredTx,
  };
}

export function selectStatsPage(state: AppState) {
  const statsPeriodOptions = ['This month', 'Last 3 months', 'This year'];
  const statsMonths = state.statsPeriod === 'This month' ? [state.historyMonth]
    : state.statsPeriod === 'Last 3 months' ? MONTH_ORDER.slice(Math.max(0, MONTH_ORDER.indexOf(state.historyMonth) - 2), MONTH_ORDER.indexOf(state.historyMonth) + 1)
    : MONTH_ORDER.filter((m) => MONTH_SUMMARIES[m]);
  const statsTx = ALL_TX.filter((t) => statsMonths.includes(t.month) && t.amount < 0);
  const statsCatTotals: Record<string, number> = {};
  statsTx.forEach((t) => { statsCatTotals[t.cat] = (statsCatTotals[t.cat] || 0) + Math.abs(t.amount); });
  const statsCatSum = Object.values(statsCatTotals).reduce((s, v) => s + v, 0);
  let acc = 0;
  const pieStops: string[] = [];
  const statsCategoryBars = Object.entries(statsCatTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
    const pct = statsCatSum > 0 ? Math.round((amt / statsCatSum) * 100) : 0;
    const color = CAT_COLOR[cat] || 'var(--color-neutral-500)';
    const start = acc, end = acc + (statsCatSum > 0 ? (amt / statsCatSum) * 360 : 0);
    pieStops.push(color + ' ' + start.toFixed(1) + 'deg ' + end.toFixed(1) + 'deg');
    acc = end;
    return { name: cat, amount: amt, amountLabel: moneyWhole(amt), pct, color };
  });
  const statsPieGradient = statsCategoryBars.length ? 'conic-gradient(' + pieStops.join(', ') + ')' : 'var(--color-neutral-300)';
  const statsCategoryDetailTxRaw = state.statsCategoryDetail ? statsTx.filter((t) => t.cat === state.statsCategoryDetail) : [];
  const statsCategoryDetailTx = statsCategoryDetailTxRaw.map((t) => ({
    ...t, ...rowBadge(t), amountLabel: '−RM ' + money(Math.abs(t.amount)), amountColor: 'var(--color-text)',
  }));
  return {
    statsPeriodOptions, statsCategoryBars, statsPieGradient, statsCategorySumLabel: moneyWhole(statsCatSum),
    statsCategoryDetailTx, statsCategoryDetailTotal: moneyWhole(statsCategoryDetailTxRaw.reduce((s, t) => s + Math.abs(t.amount), 0)),
  };
}

export function selectSubscriptions(state: AppState) {
  const FREQ_MONTHLY_FACTOR: Record<string, number> = { Monthly: 1, Weekly: 4.33, Yearly: 1 / 12, Quarterly: 1 / 3 };
  const subs = state.ob.subs;
  const monthlyTotal = subs.reduce((s, x) => s + (parseFloat(x.amount) || 0) * (FREQ_MONTHLY_FACTOR[x.frequency] || 1), 0);
  return { subs, monthlyTotal, yearlyLabel: moneyWhole(monthlyTotal * 12) };
}
