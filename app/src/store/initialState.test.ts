import { describe, it, expect } from 'vitest';
import { buildInitialState, applySyncPayload } from './initialState';
import { uid } from '../lib/ids';

// Regression test for a real bug: uid()'s counter is in-memory only and
// restarts at 1000 on every fresh page load, while receipts/transactions/
// manual records persist indefinitely (localStorage, and once signed in,
// the backend) -- see seedUidFromPersisted's doc comment in lib/ids.ts.
// Without seeding the counter from whatever a payload already contains, a
// new session could mint an id that collides with one a past session
// already gave to a *different* record — corrupting whatever later
// resolves either by that id (edit, delete, a React list key).
describe('applySyncPayload seeds the id counter from what it merges in', () => {
  it('a newly minted id never collides with one already present in the incoming payload', () => {
    const base = buildInitialState();
    const state = applySyncPayload(base, {
      receipts: [{
        id: 'rcpt-id999999', merchant: 'Old Session Receipt', dateLabel: '1 Jan 2026',
        total: 10, lineItemsTotal: 10, source: 'manual',
      }],
    });
    expect(state.receipts).toHaveLength(1);

    // The next id minted anywhere in the app must land strictly above the
    // one this "past session" payload already used.
    const next = uid();
    expect(next).not.toBe('id999999');
    expect(Number(next.slice(2))).toBeGreaterThan(999_999);
  });

  it('also seeds from ids nested in manual records (bank accounts, investments, etc.)', () => {
    const base = buildInitialState();
    const state = applySyncPayload(base, {
      manual: {
        ...base.ob.manual,
        bankAccounts: [{ id: 'id888888', name: 'Old Bank', amount: '100', date: '2026-01-01', history: [] }],
      },
    });
    expect(state.ob.manual.bankAccounts).toHaveLength(1);
    expect(Number(uid().slice(2))).toBeGreaterThan(888_888);
  });
});

describe('applySyncPayload self-heals ids a pre-fix session already duplicated', () => {
  const tx = (id: string, merchant: string) => ({
    id, merchant, cat: 'Food & Drink', dateLabel: '1 Jan 2026', dateGroup: '1 Jan 2026',
    month: 'Jan', amount: -10, tax: false, payment: 'Cash',
  });

  it('renames the second of two transactions that already share an id, keeping both records', () => {
    const base = buildInitialState();
    const state = applySyncPayload(base, {
      transactions: [tx('rcpt-tx-id1009', 'First (Grab)'), tx('rcpt-tx-id1009', 'Second (Uncle\'s Kopitiam)')],
    });

    expect(state.transactions).toHaveLength(2);
    const ids = state.transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(2); // no more duplicate
    // The first occurrence keeps its original id -- only the later
    // duplicate gets renamed, so anything already referencing the first
    // one by id (e.g. a receipt's receiptId) stays valid.
    expect(state.transactions[0].id).toBe('rcpt-tx-id1009');
    expect(state.transactions[1].id).not.toBe('rcpt-tx-id1009');
    expect(state.transactions[1].merchant).toBe('Second (Uncle\'s Kopitiam)');
  });

  it('leaves already-unique ids untouched', () => {
    const base = buildInitialState();
    const state = applySyncPayload(base, {
      transactions: [tx('rcpt-tx-id1', 'A'), tx('rcpt-tx-id2', 'B')],
    });
    expect(state.transactions.map((t) => t.id)).toEqual(['rcpt-tx-id1', 'rcpt-tx-id2']);
  });
});
