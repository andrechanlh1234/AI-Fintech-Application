// Per-account learning layer for the statement / receipt import flows.
// Keyed by a normalised merchant string, it remembers what the user
// settled a given merchant's category / expense name / payment method /
// tax-deductible flag to, and how many times they've confirmed it — so a
// second import of the same merchant pre-fills those fields, and a
// well-established one (confirmed >= 2×) is added automatically.
import type { MerchantMemory } from '../store/types';

/** Lowercase, trim, collapse internal whitespace. Returns '' for a value
 * we should neither learn from nor match against — an empty string or one
 * of the pipeline's "no idea" placeholders. */
export function normalizeMerchant(s: string): string {
  const n = (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return '';
  if (n === 'unknown' || n === 'unknown vendor' || n === 'unknown merchant') return '';
  if (n === 'uncategorised transaction' || n === 'uncategorized transaction') return '';
  return n;
}

export interface LearnableFields {
  merchant: string;
  cat: string;
  name: string;
  payment: string;
  taxDeductible: boolean;
}

/** Upsert the memory for `item.merchant` with the item's final values,
 * bumping confirmedCount. A no-op (returns `mem` unchanged) when the
 * merchant normalises to ''. */
export function upsertMerchantMemory(mem: MerchantMemory, item: LearnableFields): MerchantMemory {
  const key = normalizeMerchant(item.merchant);
  if (!key) return mem;
  const existing = mem[key];
  return {
    ...mem,
    [key]: {
      category: item.cat,
      name: item.name,
      payment: item.payment,
      taxDeductible: item.taxDeductible,
      confirmedCount: (existing?.confirmedCount ?? 0) + 1,
    },
  };
}

/** The remembered entry for a merchant, or undefined. */
export function lookupMerchantMemory(mem: MerchantMemory, merchant: string) {
  const key = normalizeMerchant(merchant);
  return key ? mem[key] : undefined;
}
