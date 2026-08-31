// Ported verbatim from Cukai v7.dc.html (lines 1610-1666, 1850-1902, 1958-1964).
import { parseDisplayDate } from './format';

const SHORT_MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Only categories that already had a hand-drawn SVG glyph keep one here
// (see TxIcon in components/TransactionRow.tsx) -- 'Education' reuses
// 'isBook' since it's the same concept the old 'Lifestyle' category used
// it for. 'Health' and 'Lifestyle' (the old bare category, now replaced by
// the specific Essential/Lifestyle categories below) are kept as aliases
// so transactions saved before this taxonomy change still render an icon
// instead of nothing. Every category without an SVG entry here falls back
// to its CAT_EMOJI glyph -- see iconFlags()/TxIcon.
export const CAT_ICON: Record<string, string> = {
  Transport: 'isCar',
  'Food & Drink': 'isCoffee',
  Shopping: 'isBag',
  Bills: 'isZap',
  Medical: 'isMedical',
  Education: 'isBook',
  Income: 'isArrowUp',
  // legacy aliases
  Health: 'isMedical',
  Lifestyle: 'isBook',
};

export const CAT_COLOR: Record<string, string> = {
  'Food & Drink': '#ef4444',
  Groceries: '#84cc16',
  Transport: '#f59e0b',
  Bills: '#3b82f6',
  Insurance: '#0ea5e9',
  Petrol: '#dc2626',
  Family: '#6366f1',
  Education: '#a855f7',
  Home: '#f97316',
  Medical: '#10b981',
  Shopping: '#8b5cf6',
  Fitness: '#06b6d4',
  Entertainment: '#ec4899',
  Travel: '#0d9488',
  Wellness: '#059669',
  Hobbies: '#eab308',
  Transfers: '#0891b2',
  Fees: '#ea580c',
  Taxes: '#475569',
  Investments: '#7c3aed',
  ATM: '#2563eb',
  Loan: '#b45309',
  'E-wallet': '#0369a1',
  Services: '#57534e',
  General: '#71717a',
  Donations: '#db2777',
  Gifts: '#e11d48',
  Income: '#14b8a6',
  Other: '#64748b',
  // legacy aliases
  Health: '#10b981',
  Lifestyle: '#ec4899',
};

// Apple-style emoji per category, for the full-page category picker
// (CategoryPickerOverlay) and as TxIcon's fallback glyph for any category
// without a hand-drawn SVG icon in CAT_ICON above.
export const CAT_EMOJI: Record<string, string> = {
  'Food & Drink': '🍔',
  Groceries: '🍎',
  Transport: '🚗',
  Bills: '🧾',
  Insurance: '🛡️',
  Petrol: '⛽',
  Family: '👨‍👩‍👧',
  Education: '📚',
  Home: '🏠',
  Medical: '💊',
  Shopping: '🛍️',
  Fitness: '💪',
  Entertainment: '📺',
  Travel: '✈️',
  Wellness: '🌿',
  Hobbies: '⭐',
  Transfers: '🔄',
  Fees: '💸',
  Taxes: '🗄️',
  Investments: '📊',
  ATM: '🏧',
  Loan: '💰',
  'E-wallet': '📱',
  Services: '💼',
  General: '🛒',
  Donations: '💝',
  Gifts: '🎁',
  Income: '💰',
  Other: '🗂️',
  // legacy aliases
  Health: '💊',
  Lifestyle: '📺',
};

// The four groups the receipt-scan category picker (CategoryPickerOverlay)
// shows as separate sections, each with its own circle background color --
// matches the reference app exactly, and intentionally excludes 'Income'
// (not a receipt category) as well as the legacy 'Health'/'Lifestyle'
// aliases above (display-only, never offered as a new choice).
export const ESSENTIAL_CATEGORIES = [
  'Food & Drink', 'Groceries', 'Transport', 'Bills', 'Insurance', 'Petrol', 'Family', 'Education', 'Home', 'Medical',
];
export const LIFESTYLE_CATEGORIES = [
  'Shopping', 'Fitness', 'Entertainment', 'Travel', 'Wellness', 'Hobbies',
];
export const MONEY_CATEGORIES = [
  'Transfers', 'Fees', 'Taxes', 'Investments', 'ATM', 'Loan', 'E-wallet',
];
export const OTHERS_CATEGORIES = [
  'Services', 'General', 'Donations', 'Gifts',
];
export const CATEGORY_GROUP_BG = {
  essential: '#C9DDFB',
  lifestyle: '#F6E3A8',
  money: '#BCEDDD',
  others: '#E3E3E3',
} as const;

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

export const CATEGORY_OPTIONS = [
  'Food & Drink', 'Groceries', 'Transport', 'Bills', 'Insurance', 'Petrol', 'Family', 'Education', 'Home', 'Medical',
  'Shopping', 'Fitness', 'Entertainment', 'Travel', 'Wellness', 'Hobbies',
  'Transfers', 'Fees', 'Taxes', 'Investments', 'ATM', 'Loan', 'E-wallet',
  'Services', 'General', 'Donations', 'Gifts',
  'Income', 'Other',
];

// The OCR pipeline (pipeline/categorize.py) classifies into its own,
// finer-grained vocabulary — map it onto the app's categories rather than
// falling back to "Other" for anything that isn't an exact string match.
const OCR_CATEGORY_MAP: Record<string, string> = {
  Medical: 'Medical',
  Groceries: 'Groceries',
  Dining: 'Food & Drink',
  Lifestyle: 'Shopping',
  Transport: 'Transport',
};

export function mapOcrCategory(category: string): string {
  return OCR_CATEGORY_MAP[category] ?? 'Other';
}

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

// Generic payment options that don't depend on any account the user has
// actually entered.
export const GENERIC_PAYMENT_METHODS = ['Cash', 'Bank Transfer', "Touch 'n Go eWallet", 'GrabPay', 'DuitNow', 'Other'];

/** Payment-method choices for a select: the user's own linked bank
 * accounts and credit cards (by name) first, then the generic fallbacks.
 * `current` is appended too if it isn't already present, so an existing
 * value (a statement-import row tagged "Bank statement", or an account
 * since renamed/removed) never renders as a silently blank selection. */
export function paymentMethodOptions(manual: { bankAccounts: { name: string }[]; creditCards: { name: string }[] }, current?: string): string[] {
  const named = [...manual.bankAccounts, ...manual.creditCards].map((r) => r.name.trim()).filter(Boolean);
  const options = [...new Set([...named, ...GENERIC_PAYMENT_METHODS])];
  if (current && !options.includes(current)) options.unshift(current);
  return options;
}

// Malaysian institutions — this is a Malaysia-only product, so a US-bank
// list (Chase/Citi) was incongruous and also fed the misleading "6 accounts
// connected" summary elsewhere.
export const LINK_TARGETS = {
  banks: [
    { id: 'maybank', name: 'Maybank', badge: { bg: '#FFC200' } },
    { id: 'cimb', name: 'CIMB Bank', badge: { bg: '#7A1F2B' } },
    { id: 'publicbank', name: 'Public Bank', badge: { bg: '#C8102E' } },
    { id: 'rhb', name: 'RHB Bank', badge: { bg: '#004A9F' } },
  ],
  cards: [
    { id: 'maybank_cc', name: 'Maybank Credit Card', badge: { bg: '#F0A500' } },
    { id: 'cimb_cc', name: 'CIMB Credit Card', badge: { bg: '#8B2331' } },
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
// Boundaries are MY_TAX_BRACKETS (taxEngine.ts) annual chargeable-income
// thresholds divided by 12 — an approximation only, since gross monthly
// income isn't the same as annual chargeable/post-relief income. Matches
// INCOME_RANGE_MID in taxEngine.ts; update both together.
export const INCOME_RANGE_OPTS = [
  'Below RM 500', 'RM 500–1,700', 'RM 1,700–2,900', 'RM 2,900–4,200', 'RM 4,200–5,800',
  'RM 5,800–8,300', 'RM 8,300–33,300', 'RM 33,300–50,000', 'RM 50,000–166,700', 'RM 166,700+',
];
export const EMPLOYMENT_OPTS = ['Employed', 'Self-employed', 'Business owner', 'Not working', 'Other'];
export const GOAL_OPTS = [
  'Build an emergency fund', 'Pay off debt', 'Save for a big purchase',
  'Grow my investments', 'Retire comfortably', 'Just track my spending',
];

// Full country list for onboarding's Country field. Alphabetical; 'Malaysia'
// is the default selected value (see initialState.ts) since this is a
// Malaysian tax app, even though it's listed here in alphabetical order.
export const COUNTRY_OPTIONS = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon',
  'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo (Congo-Brazzaville)', 'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus',
  'Czechia', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
  'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico',
  'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname',
  'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan',
  'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia',
  'Zimbabwe', 'Other',
];

// 'about' now also carries the "tax situation" questions that used to be
// their own 'txPersonal' step (merged onto one page), and the standalone
// starting-net-worth summary step was removed outright — the number is
// still shown to the user, just as the real Home dashboard immediately
// after onboarding, not as an extra page in between.
export const OB_ORDER = [
  'login', 'source', 'privacy', 'about', 'txIncomeTypes', 'txReliefs', 'txHealth',
  'goals', 'budget', 'manualSetup', 'subscriptions', 'txDone',
];

export interface IconFlags {
  isCar: boolean; isCoffee: boolean; isBag: boolean; isZap: boolean;
  isMedical: boolean; isBook: boolean; isArrowUp: boolean;
  /** Fallback glyph TxIcon renders when none of the booleans above match --
   * covers every category that doesn't have a hand-drawn SVG icon. */
  emoji: string;
}

export function iconFlags(cat: string | null): IconFlags {
  const key = cat ? CAT_ICON[cat] : undefined;
  const flags: IconFlags = {
    isCar: false, isCoffee: false, isBag: false, isZap: false, isMedical: false, isBook: false, isArrowUp: false,
    emoji: (cat && CAT_EMOJI[cat]) || '',
  };
  if (key && key in flags) flags[key as keyof Omit<IconFlags, 'emoji'>] = true;
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

export function deriveTxDate(t: { dateLabel?: string; dateGroup?: string; month: string }): { day: number; month: string; year: number } {
  const parsed = parseDisplayDate(t.dateLabel || '');
  const thisYear = new Date().getFullYear();
  if (parsed) return { day: parsed.day, month: parsed.month, year: parsed.year ?? thisYear };
  const now = new Date();
  const nowParts = { day: now.getDate(), month: SHORT_MONTHS_3[now.getMonth()], year: now.getFullYear() };
  if (t.dateGroup === 'Today' || t.dateLabel === 'Recurring') return nowParts;
  if (t.dateGroup === 'Yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { day: y.getDate(), month: SHORT_MONTHS_3[y.getMonth()], year: y.getFullYear() };
  }
  return { day: 1, month: t.month, year: thisYear };
}

// deriveTxDate()'s {day, month, year} as a sortable/comparable ISO string
// ('YYYY-MM-DD') — what the record screen's date-range filter and
// day-grouping both key off.
export function txDateIso(t: { dateLabel?: string; dateGroup?: string; month: string }): string {
  const { day, month, year } = deriveTxDate(t);
  const mm = String(MONTH_ORDER.indexOf(month) + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Shared by the onboarding budget step and the post-onboarding Budgets
// screen's "Add category" guided form — one list of common names per bucket
// so both surfaces offer the same suggestions instead of drifting apart.
export const BUDGET_COMMON_CATEGORIES: Record<string, string[]> = {
  fixed: ['Housing', 'Utilities'],
  flexible: ['Food & Drink', 'Transport', 'Shopping', 'Insurance', 'Medical Insurance'],
  goals: ['Emergency fund'],
};

export function chipStyle(active: boolean) {
  return {
    bg: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
    borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
  };
}
