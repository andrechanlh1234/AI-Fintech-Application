import type { InvestRow } from './seedData';

/** Aggregate value + gain/loss across a set of investment rows, for the
 * onboarding "Enter your finances" summary line.
 *
 * Gain is computed only from rows with a real buy price — a row with no
 * buy price entered has no cost basis, so its whole current value must
 * not be counted as "gain" (mirrors the same guard already used for the
 * per-row Net Worth detail view, InvestDetailModal.tsx's `hasBuyPrice`).
 * Bug-report L5.
 */
export function computeInvestmentsSummary(rows: InvestRow[]): { value: number; gain: number } {
  let value = 0;
  let gain = 0;
  for (const r of rows) {
    if (!r.name) continue;
    const qty = parseFloat(r.qty) || 0;
    const cur = parseFloat(r.cur) || 0;
    value += qty * cur;
    const buy = parseFloat(r.buy) || 0;
    if (buy > 0) gain += qty * cur - qty * buy;
  }
  return { value, gain };
}
