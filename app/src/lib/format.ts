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
