import { describe, it, expect } from 'vitest';
import { uid, ensureUidAbove, seedUidFromPersisted } from './ids';

// `seq` is shared, in-memory, module-level state -- every assertion here
// checks a value *relative to itself* (never a hardcoded absolute id), so
// these stay correct regardless of what earlier tests in this file (or a
// shared vitest worker) already advanced the counter to.
function numOf(id: string): number {
  return Number(id.slice(2));
}

describe('ensureUidAbove', () => {
  it('advances future uid() calls past the given number', () => {
    ensureUidAbove(500_000);
    expect(numOf(uid())).toBeGreaterThan(500_000);
  });

  it('never moves the counter backward', () => {
    ensureUidAbove(600_000);
    const before = numOf(uid());
    ensureUidAbove(10); // far below the current counter -- must be a no-op
    const after = numOf(uid());
    expect(after).toBeGreaterThan(before);
  });
});

describe('seedUidFromPersisted', () => {
  it('finds a trailing id nested anywhere inside a persisted payload and seeds past it', () => {
    seedUidFromPersisted({
      receipts: [{ id: 'rcpt-id700000' }],
      transactions: [{ id: 'rcpt-tx-id700005', nested: { another: 'id700003' } }],
    });
    expect(numOf(uid())).toBeGreaterThan(700_005);
  });

  it('ignores non-id strings and non-object/string values', () => {
    const before = numOf(uid());
    seedUidFromPersisted({ note: 'hello world', flag: true, count: 5, nothing: null });
    const after = numOf(uid());
    // Strictly +1, not a jump — proves nothing in that payload was mistaken for an id.
    expect(after).toBe(before + 1);
  });

  it('does not throw on a cyclic object', () => {
    const obj: Record<string, unknown> = { id: 'id800000' };
    obj.self = obj;
    expect(() => seedUidFromPersisted(obj)).not.toThrow();
    expect(numOf(uid())).toBeGreaterThan(800_000);
  });
});
