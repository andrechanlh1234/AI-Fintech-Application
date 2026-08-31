// Ported from Cukai v7.dc.html money()/moneyWhole()/clamp().
import { FREQ_MONTHLY_FACTOR } from './constants';

export function money(n: number): string {
  if (!Number.isFinite(n)) n = 0; // never render the literal "NaN" in a money field
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function moneyWhole(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// A comma-formatted string for display (e.g. inside an amount input or
// keypad) -- kept separate from money()/moneyWhole() above since those
// always show a settled, sign-normalized amount, while this formats
// whatever a user is actively mid-typing (no forced 2dp, no sign handling).
export function formatWithCommas(raw: string): string {
  if (!raw) return '';
  const [intPart, ...rest] = raw.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? withCommas + '.' + rest.join('') : withCommas;
}

// Digits and at most one dot, decimals capped to 2 places -- what actually
// gets dispatched to state (parseFloat-safe, no commas), separate from the
// comma-formatted string shown to the user.
export function sanitizeRaw(input: string): string {
  let s = input.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = s.split('.');
  return decPart !== undefined ? intPart + '.' + decPart.slice(0, 2) : s;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ISO "today" (YYYY-MM-DD) — the default/fallback date for anything a user
// hasn't explicitly dated yet (a new manual balance row, a balance-history
// entry). Never used to fabricate a value, only to date one.
//
// Built from LOCAL calendar components, not toISOString() (which is UTC):
// every other date helper here (dateGroupFor, computeAge, deriveTxDate)
// works in local time, so a UTC "today" made the Record range and day
// labels off by one for a Malaysia (UTC+8) user before 08:00 local.
function isoFromLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function todayIso(): string {
  return isoFromLocal(new Date());
}

// ISO date N days before today (local), the basis for every "Last N days"
// quick-filter preset.
export function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoFromLocal(d);
}

export function signedMoney(n: number): string {
  return (n >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(n));
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-07-03" -> "3 Jul 2026", for display fields fed by the OCR
// endpoint's ISO dates. Falls back to today's date if OCR found none.
export function isoToDisplayDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, year, month, day] = m;
  return `${parseInt(day, 10)} ${SHORT_MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

// Today, in the same "D Mon YYYY" shape as isoToDisplayDate — the real
// default for a fresh scan/manual-entry date field, instead of a fixed
// placeholder date that goes stale the moment real time moves past it.
export function todayDisplayDate(): string {
  return isoToDisplayDate(todayIso());
}

// Parses "D Mon" or "D Mon YYYY" (what isoToDisplayDate produces, and what a
// receipt-scan/manual date field holds) back into parts. Returns null for
// anything else rather than guessing — callers fall back to today's real
// date, never to a fabricated one.
export function parseDisplayDate(label: string): { day: number; month: string; year: number | null } | null {
  const m = /^(\d{1,2}) (\w{3})(?: (\d{4}))?$/.exec((label || '').trim());
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: m[2], year: m[3] ? parseInt(m[3], 10) : null };
}

// Inverse of isoToDisplayDate: "3 Jul 2026" -> "2026-07-03", for seeding an
// <input type="date"> from a stored dateLabel. A label with no year (an
// older "D Mon" record) assumes the current year, same fallback dateGroupFor
// already uses -- never a fabricated year. Falls back to today when the
// label doesn't parse at all, so the date field is never left blank.
export function displayDateToIso(label: string): string {
  const parsed = parseDisplayDate(label);
  if (!parsed) return todayIso();
  const rawYear = parsed.year ?? new Date().getFullYear();
  // Guard against an out-of-range year (e.g. a date field that accepted a
  // 5-digit year) producing a nonsense ISO string downstream.
  const year = rawYear >= 1900 && rawYear <= 2999 ? rawYear : new Date().getFullYear();
  const month = SHORT_MONTHS.indexOf(parsed.month);
  if (month < 0) return todayIso();
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(parsed.day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Classifies a scan/manual date label against the real current date —
// "Today"/"Yesterday" when it genuinely is, "This week" otherwise. Replaces
// blindly hardcoding dateGroup: 'Today' on every save regardless of what
// date was actually entered.
export function dateGroupFor(label: string): 'Today' | 'Yesterday' | 'This week' {
  const parsed = parseDisplayDate(label);
  if (!parsed) return 'This week';
  const now = new Date();
  const entered = new Date(parsed.year ?? now.getFullYear(), SHORT_MONTHS.indexOf(parsed.month), parsed.day);
  const diffDays = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - entered.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'This week';
}

// Subscriptions store startDate/nextPayment as ISO ("YYYY-MM-DD", what
// <input type="date"> both reads and writes) -- this derives an
// auto-suggested next payment from a start date + billing frequency,
// recomputed whenever either changes (see reducer.ts's SET_SUB_DRAFT_FIELD).
export function computeNextPayment(startDateIso: string, frequency: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateIso);
  if (!m) return '';
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  switch (frequency) {
    case 'Weekly': date.setDate(date.getDate() + 7); break;
    case 'Quarterly': date.setMonth(date.getMonth() + 3); break;
    case 'Yearly': date.setFullYear(date.getFullYear() + 1); break;
    case 'Monthly':
    default: date.setMonth(date.getMonth() + 1); break;
  }
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Onboarding stores date of birth (from <input type="date">) rather than a
// free-text age, since a stored age would silently go stale -- display age
// is always derived on the fly from this. Returns null for an empty/invalid
// dob rather than a fabricated age.
export function computeAge(dobIso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dob = new Date(Number(y), Number(mo) - 1, Number(d));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday = today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age >= 0 ? age : null;
}

// ---- Installment plans -----------------------------------------------------
// Pure derivations for a Subscription with kind === 'plan'. Nothing here is
// ever stored: remaining installments/balance, payoff date, progress and the
// monthly-equivalent are all recomputed from the plan's stored fields
// (amount = per-installment charge, totalInstallments, paidInstallments,
// startDate, frequency). MVP is flat / 0% — interestRate is display-only.
interface PlanLike {
  amount: string;
  frequency: string;
  startDate?: string;
  totalInstallments?: number;
  paidInstallments?: number;
}

// max(0, totalInstallments − paidInstallments)
export function planRemainingInstallments(plan: PlanLike): number {
  return Math.max(0, (Number(plan.totalInstallments) || 0) - (Number(plan.paidInstallments) || 0));
}

// remainingInstallments × per-installment amount (flat, 0% — MVP)
export function planRemainingBalance(plan: PlanLike): number {
  return planRemainingInstallments(plan) * (parseFloat(plan.amount) || 0);
}

// paidInstallments / totalInstallments, clamped to 0..1 (0 when no tenure).
export function planProgressPct(plan: PlanLike): number {
  const total = Number(plan.totalInstallments) || 0;
  if (total <= 0) return 0;
  return clamp((Number(plan.paidInstallments) || 0) / total, 0, 1);
}

// per-installment amount × the frequency's monthly factor.
export function planMonthlyEquivalent(plan: PlanLike): number {
  return (parseFloat(plan.amount) || 0) * (FREQ_MONTHLY_FACTOR[plan.frequency] ?? 1);
}

// startDate + totalInstallments × interval(frequency), as ISO "YYYY-MM-DD".
// Returns '' for a missing/invalid start date or a non-positive tenure —
// callers show nothing rather than a fabricated date.
export function planPayoffDate(startDateIso: string, totalInstallments: number, frequency: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateIso || '');
  if (!m || !(totalInstallments > 0)) return '';
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  for (let i = 0; i < totalInstallments; i++) {
    switch (frequency) {
      case 'Weekly': date.setDate(date.getDate() + 7); break;
      case 'Quarterly': date.setMonth(date.getMonth() + 3); break;
      case 'Yearly': date.setFullYear(date.getFullYear() + 1); break;
      case 'Monthly':
      default: date.setMonth(date.getMonth() + 1); break;
    }
  }
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Day-group header label for a transaction list row: "Today"/"Yesterday"
// when it genuinely is, otherwise "D Mon" (no year — the record screen
// only ever shows a bounded recent range, so the year is redundant).
export function isoToGroupLabel(iso: string): string {
  if (iso === todayIso()) return 'Today';
  if (iso === daysAgoIso(1)) return 'Yesterday';
  return isoToDisplayDate(iso).replace(/ \d{4}$/, '');
}
