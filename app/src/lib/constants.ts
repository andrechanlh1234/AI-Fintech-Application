// Ported verbatim from Cukai v7.dc.html (lines 1610-1666, 1850-1902, 1958-1964).
import { parseDisplayDate } from './format';

const SHORT_MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export const CATEGORY_OPTIONS = ['Food & Drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Lifestyle', 'Income', 'Other'];

// The OCR pipeline (pipeline/categorize.py) classifies into its own,
// finer-grained vocabulary — map it onto the app's categories rather than
// falling back to "Other" for anything that isn't an exact string match.
const OCR_CATEGORY_MAP: Record<string, string> = {
  Medical: 'Health',
  Groceries: 'Food & Drink',
  Dining: 'Food & Drink',
  Lifestyle: 'Lifestyle',
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
  'goals', 'budget', 'linkAccounts', 'manualSetup', 'subscriptions', 'txDone',
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
  const parsed = parseDisplayDate(t.dateLabel || '');
  if (parsed) return { day: parsed.day, month: parsed.month };
  const now = new Date();
  const nowParts = { day: now.getDate(), month: SHORT_MONTHS_3[now.getMonth()] };
  if (t.dateGroup === 'Today' || t.dateLabel === 'Recurring') return nowParts;
  if (t.dateGroup === 'Yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { day: y.getDate(), month: SHORT_MONTHS_3[y.getMonth()] };
  }
  return { day: 1, month: t.month };
}

// Shared by the onboarding budget step and the post-onboarding Budgets
// screen's "Add category" guided form — one list of common names per bucket
// so both surfaces offer the same suggestions instead of drifting apart.
export const BUDGET_COMMON_CATEGORIES: Record<string, string[]> = {
  fixed: ['Housing', 'Utilities'],
  flexible: ['Food & Drink', 'Transport', 'Shopping'],
  goals: ['Emergency fund'],
  insurance: ['Medical Insurance'],
};

export function chipStyle(active: boolean) {
  return {
    bg: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text)',
    borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
  };
}
