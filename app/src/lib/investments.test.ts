import { describe, it, expect } from 'vitest';
import { computeInvestmentsSummary } from './investments';
import { mkInvestRow } from './seedData';

describe('computeInvestmentsSummary', () => {
  it('returns zero value and gain for an empty list', () => {
    expect(computeInvestmentsSummary([])).toEqual({ value: 0, gain: 0 });
  });

  it('ignores rows with no name (an in-progress, not-yet-filled row)', () => {
    const row = mkInvestRow('', '10', '5', '8');
    expect(computeInvestmentsSummary([row])).toEqual({ value: 0, gain: 0 });
  });

  it('computes value and gain for a row with a real buy price', () => {
    const row = mkInvestRow('Apple stock', '10', '5', '8'); // qty 10, buy RM5, cur RM8
    expect(computeInvestmentsSummary([row])).toEqual({ value: 80, gain: 30 });
  });

  it('computes a loss when current price is below buy price', () => {
    const row = mkInvestRow('BTC', '2', '100', '60');
    expect(computeInvestmentsSummary([row])).toEqual({ value: 120, gain: -80 });
  });

  // Bug-report L5: with no buy price entered, the row has no cost basis, so
  // its whole current value must not be counted as "gain" (mirrors the
  // hasBuyPrice guard already used in InvestDetailModal.tsx's per-row view).
  it('counts a blank-buy-price row toward value but not toward gain', () => {
    const row = mkInvestRow('Unpriced stock', '10', '', '1000');
    expect(computeInvestmentsSummary([row])).toEqual({ value: 10000, gain: 0 });
  });

  it('treats a zero buy price the same as blank (no cost basis)', () => {
    const row = mkInvestRow('Zero-buy stock', '10', '0', '1000');
    expect(computeInvestmentsSummary([row])).toEqual({ value: 10000, gain: 0 });
  });

  it('aggregates a mix of priced and unpriced rows correctly', () => {
    const priced = mkInvestRow('Apple stock', '10', '5', '8'); // value 80, gain 30
    const unpriced = mkInvestRow('Unpriced stock', '10', '', '1000'); // value 10000, gain excluded
    expect(computeInvestmentsSummary([priced, unpriced])).toEqual({ value: 10080, gain: 30 });
  });
});
