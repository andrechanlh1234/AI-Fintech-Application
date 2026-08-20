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
