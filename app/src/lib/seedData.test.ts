import { describe, it, expect } from 'vitest';
import { AI_CHAT_HISTORY, NOTIFICATIONS } from './seedData';

// Regression lock: neither of these may carry fabricated sample rows that
// render as if they were the signed-in user's own data. They stay empty
// until there is a real per-user source for each (see the comments above
// their definitions in seedData.ts). Bug-report H3 / M8.
describe('no fabricated user data ships in seedData', () => {
  it('AI_CHAT_HISTORY is empty', () => {
    expect(AI_CHAT_HISTORY).toEqual([]);
  });

  it('NOTIFICATIONS is empty', () => {
    expect(NOTIFICATIONS).toEqual([]);
  });
});
