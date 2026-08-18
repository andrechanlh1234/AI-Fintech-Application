// Ported verbatim from Cukai v7.dc.html (lines 1715-1848, 1939-1942).
// LHDN (Malaysian tax) relief categories, caps, YA2026/YA2025 sample capture
// data, and the tax bracket / benefit calculation engine.

export interface TaxItemMeta {
  key: string;
  label: string;
  cap: number;
  automatic?: boolean;
}

export const TAX_GROUPS_META = [
  { key: 'individual', label: 'Individual', icon: 'isPerson' },
  { key: 'medical', label: 'Medical & Special Needs', icon: 'isMedical' },
  { key: 'lifestyle', label: 'Lifestyle', icon: 'isBook' },
  { key: 'epf', label: 'EPF & Life Insurance', icon: 'isShield' },
  { key: 'child', label: 'Child Relief', icon: 'isUsers' },
] as const;

export const TAX_ITEMS_META: Record<string, TaxItemMeta[]> = {
  individual: [
    { key: 'indiv_self', label: 'Individual & Dependent Relatives', cap: 9000, automatic: true },
    { key: 'indiv_disabled', label: 'Disabled Individual', cap: 6000 },
    { key: 'indiv_education', label: 'Education Fees', cap: 7000 },
    { key: 'indiv_skills', label: 'Skills Enhancement / Personal Development', cap: 2000 },
    { key: 'indiv_housing', label: 'Interest on Housing Loan – First Home', cap: 7000 },
    { key: 'indiv_spouse', label: 'Husband/Wife/Alimony', cap: 4000 },
    { key: 'indiv_disabled_spouse', label: 'Disabled Husband/Wife', cap: 5000 },
  ],
  medical: [
    { key: 'med_self', label: 'Self/Spouse/Child Medical', cap: 10000 },
    { key: 'med_parents', label: 'Parents & Grandparents Medical', cap: 8000 },
    { key: 'med_equipment', label: 'Disabled Individual Support Equipment', cap: 6000 },
  ],
  lifestyle: [
    { key: 'life_general', label: 'Lifestyle', cap: 2500 },
    { key: 'life_additional', label: 'Additional Lifestyle Relief', cap: 1000 },
    { key: 'life_ev', label: 'EV Charging Equipment / Domestic Food Waste Composting Machine', cap: 2500 },
  ],
  epf: [
    { key: 'epf_life', label: 'Life Insurance & EPF', cap: 7000 },
    { key: 'epf_edu_med', label: 'Education & Medical Insurance', cap: 3000 },
    { key: 'epf_prs', label: 'PRS / Deferred Annuity', cap: 3000 },
    { key: 'epf_sspn', label: 'SSPN', cap: 8000 },
    { key: 'epf_socso', label: 'SOCSO', cap: 350 },
  ],
  child: [
    { key: 'child_under18', label: 'Child below 18', cap: 2000 },
    { key: 'child_edu', label: 'Child 18+ in Education', cap: 8000 },
    { key: 'child_disabled', label: 'Unmarried Child with Disabilities', cap: 8000 },
    { key: 'child_care', label: 'Registered Childcare / Kindergarten', cap: 3000 },
    { key: 'child_breastfeed', label: 'Breastfeeding Equipment', cap: 1000 },
  ],
};

export interface TaxReceipt { merchant: string; amount: number; dateLabel: string }
export interface TaxItemData { captured: number; receipts: TaxReceipt[] }

export const TAX_ITEM_DATA: Record<string, Record<string, TaxItemData>> = {
  YA2026: {
    indiv_self: { captured: 9000, receipts: [] },
    indiv_education: { captured: 1600, receipts: [{ merchant: 'UNITAR Course Fees', amount: 1600.0, dateLabel: '2 Aug 2026' }] },
    indiv_skills: { captured: 450, receipts: [{ merchant: 'Coursera Subscription', amount: 450.0, dateLabel: '14 Jul 2026' }] },
    med_self: { captured: 1940, receipts: [{ merchant: 'Klinik Mediviron', amount: 120.0, dateLabel: '6 Aug 2026' }, { merchant: 'Guardian Pharmacy', amount: 43.2, dateLabel: '5 Aug 2026' }] },
    med_parents: { captured: 1000, receipts: [{ merchant: "Mum's Clinic Visit", amount: 380.0, dateLabel: '28 Jul 2026' }] },
    life_general: { captured: 2180, receipts: [{ merchant: 'Popular Bookstore', amount: 86.0, dateLabel: '9 Aug 2026' }] },
    epf_life: { captured: 1520, receipts: [{ merchant: 'Prudential Premium', amount: 540.0, dateLabel: '1 Aug 2026' }] },
    epf_socso: { captured: 350, receipts: [{ merchant: 'SOCSO (PERKESO) — payroll', amount: 350.0, dateLabel: 'Ongoing' }] },
  },
  YA2025: {
    indiv_self: { captured: 9000, receipts: [] },
    indiv_education: { captured: 1400, receipts: [{ merchant: 'INTI College Fees', amount: 1400.0, dateLabel: '1 Dec 2025' }] },
    med_self: { captured: 1700, receipts: [{ merchant: 'Klinik Famili', amount: 95.0, dateLabel: '8 Dec 2025' }, { merchant: 'Watsons Pharmacy', amount: 38.5, dateLabel: '3 Dec 2025' }] },
    med_parents: { captured: 900, receipts: [{ merchant: "Dad's Physiotherapy", amount: 310.0, dateLabel: '20 Nov 2025' }] },
    life_general: { captured: 1850, receipts: [{ merchant: 'Kinokuniya Bookstore', amount: 72.0, dateLabel: '12 Dec 2025' }] },
    epf_life: { captured: 1500, receipts: [{ merchant: 'AIA Premium', amount: 480.0, dateLabel: '28 Nov 2025' }] },
    epf_socso: { captured: 350, receipts: [{ merchant: 'SOCSO (PERKESO) — payroll', amount: 350.0, dateLabel: 'Ongoing' }] },
  },
};

export const ASSUMED_TAX_RATE = 0.24;

export const MY_TAX_BRACKETS = [
  { upTo: 5000, rate: 0 }, { upTo: 20000, rate: 0.01 }, { upTo: 35000, rate: 0.03 }, { upTo: 50000, rate: 0.06 },
  { upTo: 70000, rate: 0.11 }, { upTo: 100000, rate: 0.19 }, { upTo: 400000, rate: 0.25 }, { upTo: 600000, rate: 0.26 },
  { upTo: 2000000, rate: 0.28 }, { upTo: Infinity, rate: 0.3 },
];

export function marginalTaxRate(chargeableIncome: number): number {
  for (const b of MY_TAX_BRACKETS) if (chargeableIncome <= b.upTo) return b.rate;
  return 0.3;
}

const INCOME_RANGE_MID: Record<string, number> = {
  'Below RM 3,000': 2500, 'RM 3,000–6,000': 4500, 'RM 6,000–10,000': 8000,
  'RM 10,000–20,000': 15000, 'RM 20,000+': 25000,
};

export function estimateAnnualIncome(rangeLabel: string | null | undefined): number {
  return (INCOME_RANGE_MID[rangeLabel || ''] || 0) * 12;
}

export interface TaxProfile {
  marital: string | null;
  dependants: string | null;
  reliefs: string[];
  hasDisability: string | null;
  hasHousingLoan: string | null;
}

const TAX_RELEVANCE_RULES: Record<string, (p: TaxProfile) => boolean> = {
  indiv_disabled: (p) => p.hasDisability === 'Yes',
  indiv_education: (p) => p.reliefs.includes('Education'),
  indiv_skills: (p) => p.reliefs.includes('Education'),
  indiv_housing: (p) => p.hasHousingLoan === 'Yes',
  indiv_spouse: (p) => p.marital === 'Married',
  indiv_disabled_spouse: (p) => p.marital === 'Married' && p.hasDisability === 'Yes',
  med_parents: (p) => p.reliefs.includes('Parents / dependants'),
  med_equipment: (p) => p.hasDisability === 'Yes',
  epf_life: (p) => p.reliefs.includes('Insurance') || p.reliefs.includes('EPF / retirement'),
  epf_edu_med: (p) => p.reliefs.includes('Insurance'),
  epf_prs: (p) => p.reliefs.includes('EPF / retirement'),
  epf_sspn: (p) => !!p.dependants && p.dependants !== '0',
  child_under18: (p) => !!p.dependants && p.dependants !== '0',
  child_edu: (p) => !!p.dependants && p.dependants !== '0',
  child_disabled: (p) => !!p.dependants && p.dependants !== '0' && p.hasDisability === 'Yes',
  child_care: (p) => !!p.dependants && p.dependants !== '0',
  child_breastfeed: (p) => !!p.dependants && p.dependants !== '0',
};

export function isTaxItemRelevant(key: string, im: TaxItemMeta, profile: TaxProfile | null): boolean {
  if (im.automatic || !profile) return true;
  const rule = TAX_RELEVANCE_RULES[key];
  return rule ? rule(profile) : true;
}

export interface TaxModelItem {
  key: string; label: string; cap: number; captured: number; pct: number; remaining: number;
  potentialBenefit: number; status: string;
  receipts: { merchant: string; amount: number; dateLabel: string; isOther: boolean }[];
  rawReceipts: TaxReceipt[];
}
export interface TaxModelGroup {
  key: string; label: string; icon: string; items: TaxModelItem[];
  captured: number; cap: number; pct: number; remaining: number; potentialBenefit: number; status: string;
}
export interface TaxModel {
  groups: TaxModelGroup[]; totalCaptured: number; totalCap: number; totalRemaining: number;
  totalPotentialBenefit: number;
  allReceipts: { merchant: string; amount: number; dateLabel: string; itemLabel: string; groupKey: string }[];
}

export function buildTaxModel(taxYear: string, profile: TaxProfile | null, rate?: number): TaxModel {
  const r = rate == null ? ASSUMED_TAX_RATE : rate;
  const itemData = TAX_ITEM_DATA[taxYear] || {};
  const groups: TaxModelGroup[] = TAX_GROUPS_META.map((g) => {
    const items: TaxModelItem[] = TAX_ITEMS_META[g.key]
      .filter((im) => isTaxItemRelevant(im.key, im, profile))
      .map((im) => {
        const d = itemData[im.key] || { captured: 0, receipts: [] };
        const captured = d.captured, cap = im.cap;
        const receiptsSum = d.receipts.reduce((s, x) => s + x.amount, 0);
        const otherAmount = Math.max(0, captured - receiptsSum);
        const receipts = d.receipts.map((x) => ({ merchant: x.merchant, amount: x.amount, dateLabel: x.dateLabel, isOther: false }));
        if (otherAmount > 0.5) receipts.push({ merchant: 'Other eligible expenses', amount: otherAmount, dateLabel: '', isOther: true });
        const pct = cap > 0 ? Math.min(100, Math.round((captured / cap) * 100)) : 0;
        const remaining = Math.max(0, cap - captured);
        const potentialBenefit = Math.round(remaining * r);
        const status = im.automatic ? 'Automatic' : pct >= 85 ? 'Optimised' : captured > 0 ? 'In progress' : 'Available';
        return { key: im.key, label: im.label, cap, captured, pct, remaining, potentialBenefit, status, receipts, rawReceipts: d.receipts };
      });
    const captured = items.reduce((s, it) => s + it.captured, 0);
    const cap = items.reduce((s, it) => s + it.cap, 0);
    const pct = cap > 0 ? Math.min(100, Math.round((captured / cap) * 100)) : 0;
    const remaining = Math.max(0, cap - captured);
    const potentialBenefit = Math.round(remaining * r);
    const status = pct >= 85 ? 'Optimised' : captured > 0 ? 'In progress' : 'Available';
    return { key: g.key, label: g.label, icon: g.icon, items, captured, cap, pct, remaining, potentialBenefit, status };
  });
  const totalCaptured = groups.reduce((s, g) => s + g.captured, 0);
  const totalCap = groups.reduce((s, g) => s + g.cap, 0);
  const totalRemaining = groups.reduce((s, g) => s + g.remaining, 0);
  const totalPotentialBenefit = groups.reduce((s, g) => s + g.potentialBenefit, 0);
  const allReceipts: TaxModel['allReceipts'] = [];
  groups.forEach((g) => g.items.forEach((it) => it.rawReceipts.forEach((r2) =>
    allReceipts.push({ merchant: r2.merchant, amount: r2.amount, dateLabel: r2.dateLabel, itemLabel: it.label, groupKey: g.key }))));
  return { groups, totalCaptured, totalCap, totalRemaining, totalPotentialBenefit, allReceipts };
}

export const RELIEF_INFO: Record<string, { name: string; cap: number; before: number; why: string }> = {
  Lifestyle: { name: 'Lifestyle Relief', cap: 2500, before: 2180, why: "Books, personal computers/smartphones, sports equipment and internet subscriptions qualify under LHDN's Lifestyle relief." },
  Health: { name: 'Medical Expenses Relief', cap: 8000, before: 1940, why: 'Medical treatment for yourself, your spouse or child is deductible under the Medical Expenses relief.' },
};

export const TAX_GROUP_ICON: Record<string, string> = { individual: 'isPerson', medical: 'isMedical', lifestyle: 'isBook', epf: 'isShield', child: 'isUsers' };

export function taxGroupIconFlags(groupKey: string) {
  const flags: Record<string, boolean> = { isPerson: false, isMedical: false, isBook: false, isShield: false, isUsers: false };
  const key = TAX_GROUP_ICON[groupKey];
  if (key) flags[key] = true;
  return flags;
}
