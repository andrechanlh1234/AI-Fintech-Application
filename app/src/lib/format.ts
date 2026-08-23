// Ported from Cukai v7.dc.html money()/moneyWhole()/clamp().

export function money(n: number): string {
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function moneyWhole(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ISO "today" (YYYY-MM-DD) — the default/fallback date for anything a user
// hasn't explicitly dated yet (a new manual balance row, a balance-history
// entry). Never used to fabricate a value, only to date one.
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  const year = parsed.year ?? new Date().getFullYear();
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
