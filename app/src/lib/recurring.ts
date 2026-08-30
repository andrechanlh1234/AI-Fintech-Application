import type { AppState } from '../store/types';
import type { Transaction } from './seedData';
import { dateGroupFor } from './format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Current calendar month as YYYY-MM. */
export function currentRecurMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function plannedAmount(cat: { cap: number; items: { amount: number | string }[] }): number {
  if (cat.cap > 0) return cat.cap;
  return cat.items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);
}

/**
 * For every budget category flagged `recurring`, make sure the CURRENT month
 * has an auto transaction for its planned amount. Never backfills past
 * months; never regenerates a month once it's in `recurGeneratedMonths`
 * (so deleting a generated transaction is permanent). Returns the
 * transactions to append plus the updated ledger, or null if nothing to do.
 */
export function materializeRecurring(state: AppState): { transactions: Transaction[]; generated: Record<string, string[]> } | null {
  const ym = currentRecurMonth();
  const [yearStr, mmStr] = ym.split('-');
  const year = Number(yearStr);
  const monName = MONTHS[Number(mmStr) - 1];

  const generated: Record<string, string[]> = { ...state.recurGeneratedMonths };
  const newTx: Transaction[] = [];
  let changed = false;

  for (const bucket of state.finance.buckets) {
    for (const cat of bucket.categories) {
      if (!cat.recurring) continue;
      const amount = plannedAmount(cat);
      if (amount <= 0) continue;
      const done = generated[cat.id] || [];
      if (done.includes(ym)) continue;

      const id = `recur-${cat.id}-${ym}`;
      if (!state.transactions.some((t) => t.id === id)) {
        const day = Math.min(28, Math.max(1, cat.recurDay || 1));
        const dateLabel = `${day} ${monName} ${year}`;
        newTx.push({
          id,
          merchant: cat.name,
          cat: cat.name,
          dateLabel,
          dateGroup: dateGroupFor(dateLabel),
          month: monName,
          amount: -amount,
          tax: false,
          payment: 'Recurring',
          auto: true,
          recurCatId: cat.id,
          recurMonth: ym,
        });
      }
      generated[cat.id] = [...done, ym];
      changed = true;
    }
  }

  return changed ? { transactions: newTx, generated } : null;
}
