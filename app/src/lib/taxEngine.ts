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

// TAX ACCURACY REVIEW (2026-08-20): these caps were checked against
// Claude's general knowledge of LHDN's individual relief structure — not
// a live LHDN lookup, and not a licensed tax advisor's sign-off. High
// confidence on all except:
//  - child_disabled (RM8,000, "Unmarried Child with Disabilities"): may
//    conflate the base disabled-child relief (commonly cited as RM6,000)
//    with the additional relief for a disabled child in higher education
//    (commonly cited as RM8,000) — these may be two separate line items,
//    not one combined RM8,000 relief.
//  - life_ev (RM2,500, EV charging equipment / food-waste composting
//    machine): bundling these two into a single relief item is unverified.
// Get a licensed tax professional (or a direct LHDN source check) to
// confirm every figure here before treating any of it as authoritative
// for a real filing — see the disclaimer already shown in the Tax Center.
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

// Which LHDN relief item a scanned/reviewed expense category counts toward.
// Only categories with a clear, defensible LHDN correspondence are mapped;
// everything else returns null (not auto-assigned to any relief item) rather
// than guessing. This drives real captured-amount totals — there is no
// hardcoded per-item "captured" data anymore; see selectTaxCenter in
// store/selectors.ts, which builds a capturedData map from state.transactions.
const CATEGORY_TO_RELIEF_KEY: Record<string, string> = {
  Lifestyle: 'life_general',
  Health: 'med_self',
  Shopping: 'life_general',
  Bills: 'life_general',
};

export function categoryToReliefKey(category: string): string | null {
  return CATEGORY_TO_RELIEF_KEY[category] ?? null;
}

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

// Mirrors lib/constants.ts's INCOME_RANGE_OPTS, whose boundaries are these
// same MY_TAX_BRACKETS annual thresholds divided by 12 — an approximation
// only, since gross monthly income isn't the same as annual chargeable/
// post-relief income (same caveat as the app's "verify with HASiL" notices).
// Update both lists together.
const INCOME_RANGE_MID: Record<string, number> = {
  'Below RM 500': 300, 'RM 500–1,700': 1100, 'RM 1,700–2,900': 2300, 'RM 2,900–4,200': 3550,
  'RM 4,200–5,800': 5000, 'RM 5,800–8,300': 7050, 'RM 8,300–33,300': 20800,
  'RM 33,300–50,000': 41650, 'RM 50,000–166,700': 108350, 'RM 166,700+': 200000,
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
  // pct is the TRUE capture rate, uncapped -- barPct is the same value
  // clamped to 100 for progress-bar width only. Claiming past a relief's
  // cap is a real (if unusual) case; the % Complete badge must show it,
  // not silently read back as 100%.
  key: string; label: string; cap: number; captured: number; pct: number; barPct: number; remaining: number;
  potentialBenefit: number; status: string;
  receipts: { merchant: string; amount: number; dateLabel: string; isOther: boolean }[];
  rawReceipts: TaxReceipt[];
}
export interface TaxModelGroup {
  key: string; label: string; icon: string; items: TaxModelItem[];
  captured: number; cap: number; pct: number; barPct: number; remaining: number; potentialBenefit: number; status: string;
}
export interface TaxModel {
  groups: TaxModelGroup[]; totalCaptured: number; totalCap: number; totalRemaining: number;
  totalPotentialBenefit: number;
  allReceipts: { merchant: string; amount: number; dateLabel: string; itemLabel: string; groupKey: string }[];
}

export function buildTaxModel(profile: TaxProfile | null, capturedData: Record<string, TaxItemData>, rate?: number): TaxModel {
  const r = rate == null ? ASSUMED_TAX_RATE : rate;
  const itemData = capturedData;
  const groups: TaxModelGroup[] = TAX_GROUPS_META.map((g) => {
    const items: TaxModelItem[] = TAX_ITEMS_META[g.key]
      .filter((im) => isTaxItemRelevant(im.key, im, profile))
      .map((im) => {
        // "automatic" items (currently just the base Individual & Dependent
        // Relatives relief) are a standard entitlement every resident
        // taxpayer gets with no receipts required — always fully captured,
        // unlike everything else here which only counts real transactions.
        const d = im.automatic ? { captured: im.cap, receipts: [] } : (itemData[im.key] || { captured: 0, receipts: [] });
        const captured = d.captured, cap = im.cap;
        const receiptsSum = d.receipts.reduce((s, x) => s + x.amount, 0);
        const otherAmount = Math.max(0, captured - receiptsSum);
        const receipts = d.receipts.map((x) => ({ merchant: x.merchant, amount: x.amount, dateLabel: x.dateLabel, isOther: false }));
        if (otherAmount > 0.5) receipts.push({ merchant: 'Other eligible expenses', amount: otherAmount, dateLabel: '', isOther: true });
        const pct = cap > 0 ? Math.round((captured / cap) * 100) : 0;
        const remaining = Math.max(0, cap - captured);
        const potentialBenefit = Math.round(remaining * r);
        const status = im.automatic ? 'Automatic' : pct >= 85 ? 'Optimised' : captured > 0 ? 'In progress' : 'Available';
        return { key: im.key, label: im.label, cap, captured, pct, barPct: Math.min(100, pct), remaining, potentialBenefit, status, receipts, rawReceipts: d.receipts };
      });
    const captured = items.reduce((s, it) => s + it.captured, 0);
    const cap = items.reduce((s, it) => s + it.cap, 0);
    const pct = cap > 0 ? Math.round((captured / cap) * 100) : 0;
    const remaining = Math.max(0, cap - captured);
    const potentialBenefit = Math.round(remaining * r);
    const status = pct >= 85 ? 'Optimised' : captured > 0 ? 'In progress' : 'Available';
    return { key: g.key, label: g.label, icon: g.icon, items, captured, cap, pct, barPct: Math.min(100, pct), remaining, potentialBenefit, status };
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

// Static reference info only — "before" (how much of the cap is already
// captured) is computed live from the user's actual transactions in
// selectReliefImpact (store/selectors.ts), not hardcoded here.
export const RELIEF_INFO: Record<string, { name: string; cap: number; why: string }> = {
  Lifestyle: { name: 'Lifestyle Relief', cap: 2500, why: "Books, personal computers/smartphones, sports equipment and internet subscriptions qualify under LHDN's Lifestyle relief." },
  Health: { name: 'Medical Expenses Relief', cap: 10000, why: 'Medical treatment for yourself, your spouse or child is deductible under the Medical Expenses relief.' },
};

export const TAX_GROUP_ICON: Record<string, string> = { individual: 'isPerson', medical: 'isMedical', lifestyle: 'isBook', epf: 'isShield', child: 'isUsers' };

export function taxGroupIconFlags(groupKey: string) {
  const flags: Record<string, boolean> = { isPerson: false, isMedical: false, isBook: false, isShield: false, isUsers: false };
  const key = TAX_GROUP_ICON[groupKey];
  if (key) flags[key] = true;
  return flags;
}
