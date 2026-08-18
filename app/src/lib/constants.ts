// Ported verbatim from Cukai v7.dc.html (lines 1610-1666, 1850-1902, 1958-1964).

export const CAT_ICON: Record<string, string> = {
  Transport: 'isCar',
  'Food & Drink': 'isCoffee',
  Shopping: 'isBag',
  Bills: 'isZap',
  Health: 'isMedical',
  Income: 'isArrowUp',
  Lifestyle: 'isBook',
};

export const CAT_COLOR: Record<string, string> = {
  Transport: '#f59e0b',
  'Food & Drink': '#ef4444',
  Shopping: '#8b5cf6',
  Bills: '#3b82f6',
  Health: '#10b981',
  Income: '#14b8a6',
  Lifestyle: '#ec4899',
};

export const NW_GROUP_ICON: Record<string, string> = {
  cash: '💵',
  invest: '📈',
  other: '🏠',
  liab: '💳',
};

export const MONTH_FULL: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

export const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const NETWORTH_MONTH_LABELS = [
  'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26',
  'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26',
];

export const CATEGORY_OPTIONS = ['Food & Drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Lifestyle', 'Income', 'Other'];

export const TAX_SHADES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

export interface Brand { bg: string; letter: string; fg: string }

export const BRAND: Record<string, Brand> = {
  grab: { bg: '#00874E', letter: 'G', fg: '#fff' },
  tealive: { bg: '#C8102E', letter: 'T', fg: '#fff' },
  guardian: { bg: '#003DA5', letter: 'G', fg: '#fff' },
  shopee: { bg: '#EE4D2D', letter: 'S', fg: '#fff' },
  gmail: { bg: 'var(--color-neutral-500)', letter: '✉', fg: '#fff' },
  maybank: { bg: '#FFC72C', letter: 'M', fg: '#1a1a1a' },
  cimb: { bg: '#7A1F2B', letter: 'C', fg: '#fff' },
  uob: { bg: '#0b3b8c', letter: 'U', fg: '#fff' },
  tng: { bg: '#1B5FAA', letter: 'T', fg: '#fff' },
  moomoo: { bg: '#1a1a2e', letter: 'M', fg: '#fff' },
};

export const PAYMENT_METHODS = [
  'Maybank Visa', 'CIMB Credit Card', 'UOB Preferred Visa', "Touch 'n Go eWallet",
  'GrabPay', 'Bank Transfer', 'DuitNow', 'Cash',
];

export const LINK_TARGETS = {
  banks: [
    { id: 'chase', name: 'Chase', badge: { bg: '#004C97' } },
    { id: 'citi', name: 'Citi', badge: { bg: '#003D79' } },
  ],
  cards: [
    { id: 'chase_cc', name: 'Chase Freedom Visa', badge: { bg: '#117ACA' } },
    { id: 'citi_cc', name: 'Citi Double Cash', badge: { bg: '#7A1F2B' } },
  ],
  investing: [
    { id: 'brokerage', name: 'Brokerage / Investment Account', badge: { bg: '#1a1a2e' } },
  ],
  crypto: [
    { id: 'btc', name: 'Bitcoin Wallet', badge: { bg: '#F7931A' } },
    { id: 'eth', name: 'Ethereum Wallet', badge: { bg: '#627EEA' } },
  ],
};

export function linkBadgeLetter(name: string): string {
  return name[0].toUpperCase();
}

const SUB_BRAND: Record<string, { bg: string; letter: string }> = {
  netflix: { bg: '#E50914', letter: 'N' },
  spotify: { bg: '#1DB954', letter: 'S' },
};
const SUB_PALETTE = ['#7C3AED', '#0EA5E9', '#16A34A', '#F59E0B', '#DB2777', '#334155'];

export function subBadge(name: string): { bg: string; letter: string; fg: string } {
  const n = (name || '').trim();
  const key = n.toLowerCase();
  if (SUB_BRAND[key]) return { bg: SUB_BRAND[key].bg, letter: SUB_BRAND[key].letter, fg: '#fff' };
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) | 0;
  return { bg: SUB_PALETTE[Math.abs(hash) % SUB_PALETTE.length], letter: n ? n[0].toUpperCase() : '?', fg: '#fff' };
}

export const FREQ_MONTHLY_FACTOR: Record<string, number> = { Monthly: 1, Weekly: 4.33, Yearly: 1 / 12, Quarterly: 1 / 3 };
export const SUB_FREQUENCY_OPTIONS = ['Monthly', 'Yearly', 'Weekly', 'Quarterly'];
export const SUB_CATEGORY_OPTIONS = ['Entertainment', 'Utilities', 'Software', 'Fitness', 'News', 'Other'];

export const SOURCE_OPTS = ['Friend or family', 'TikTok', 'Instagram', 'YouTube', 'Google', 'Reddit', 'Advertisement', 'Other'];
export const RELIEF_OPTS = [
  'Insurance', 'Medical expenses', 'Education', 'Lifestyle expenses', 'Internet / mobile',
  'Books', 'Sports / fitness', 'Donations', 'EPF / retirement', 'Parents / dependants', 'Other',
];
export const INCOME_TYPE_OPTS = ['Bonus', 'Freelance / side income', 'Investment income', 'Rental income', 'Other'];
export const INCOME_RANGE_OPTS = ['Below RM 3,000', 'RM 3,000–6,000', 'RM 6,000–10,000', 'RM 10,000–20,000', 'RM 20,000+'];
export const EMPLOYMENT_OPTS = ['Employed', 'Self-employed', 'Business owner', 'Not working', 'Other'];
export const GOAL_OPTS = [
  'Build an emergency fund', 'Pay off debt', 'Save for a big purchase',
  'Grow my investments', 'Retire comfortably', 'Just track my spending',
];

export const OB_ORDER = [
  'login', 'source', 'privacy', 'about', 'txPersonal', 'txIncomeTypes', 'txReliefs', 'txHealth',
  'goals', 'linkAccounts', 'manualSetup', 'subscriptions', 'netWorth', 'txDone',
];

export interface IconFlags {
  isCar: boolean; isCoffee: boolean; isBag: boolean; isZap: boolean;
  isMedical: boolean; isBook: boolean; isArrowUp: boolean;
}

export function iconFlags(cat: string | null): IconFlags {
  const key = cat ? CAT_ICON[cat] : undefined;
  const flags: IconFlags = { isCar: false, isCoffee: false, isBag: false, isZap: false, isMedical: false, isBook: false, isArrowUp: false };
  if (key && key in flags) flags[key as keyof IconFlags] = true;
  return flags;
}

export interface RowBadge extends IconFlags {
  hasBrand: boolean; badgeBg: string; badgeLetter: string; badgeFg: string;
}

export function rowBadge(item: { brand?: string | null; cat?: string }): RowBadge {
  const b = item.brand && BRAND[item.brand];
  if (b) return { hasBrand: true, badgeBg: b.bg, badgeLetter: b.letter, badgeFg: b.fg, ...iconFlags(null) };
  return { hasBrand: false, badgeBg: 'var(--color-neutral-200)', badgeLetter: '', badgeFg: 'var(--color-text-muted)', ...iconFlags(item.cat ?? null) };
}

export function deriveTxDate(t: { dateLabel?: string; dateGroup?: string; month: string }): { day: number; month: string } {
  const m = (t.dateLabel || '').match(/^(\d{1,2}) (\w{3})$/);
  if (m) return { day: +m[1], month: m[2] };
  if (t.dateGroup === 'Today') return { day: 15, month: 'Aug' };
  if (t.dateGroup === 'Yesterday') return { day: 14, month: 'Aug' };
  if (t.dateLabel === 'Mon') return { day: 11, month: 'Aug' };
  if (t.dateLabel === 'Sun') return { day: 10, month: 'Aug' };
  if (t.dateLabel === 'Recurring') return { day: 5, month: 'Aug' };
  return { day: 1, month: t.month };
}

export function chipStyle(active: boolean) {
  return {
    bg: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
    borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
  };
}
