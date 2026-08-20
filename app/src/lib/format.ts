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
