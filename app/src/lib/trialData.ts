// Realistic sample data for Developer mode's "Load trial data" action —
// exists purely so a developer testing the app isn't stuck manually
// re-entering accounts/transactions after every reset. Never reachable by a
// real customer: gated behind userMode === 'developer' in MorePanel.tsx, and
// clearly a deliberate, explicit developer action, not something shown to a
// user as if it were their own real data (unlike the fabricated REVIEW_ITEMS
// this app used to ship with).
import type { ManualData, Subscription } from '../store/types';
import type { Transaction } from './seedData';
import { mkRecord, mkCategory, mkItem, defaultBuckets, type Bucket } from './seedData';
import { isoToDisplayDate, dateGroupFor } from './format';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function mkTx(id: string, merchant: string, cat: string, amount: number, daysAgo: number, opts: { tax?: boolean; reliefKey?: string; payment?: string; brand?: string } = {}): Transaction {
  const iso = isoDaysAgo(daysAgo);
  const dateLabel = isoToDisplayDate(iso);
  const [y, m] = iso.split('-');
  return {
    id, merchant, cat, dateLabel, dateGroup: dateGroupFor(dateLabel), month: SHORT_MONTHS[Number(m) - 1],
    amount, tax: !!opts.tax, reliefKey: opts.reliefKey, payment: opts.payment ?? 'Maybank Visa', brand: opts.brand,
  };
}

export interface TrialData {
  manual: Pick<ManualData, 'bankAccounts' | 'creditCards'>;
  transactions: Transaction[];
  buckets: Bucket[];
  subs: Subscription[];
}

export function buildTrialData(): TrialData {
  const manual: Pick<ManualData, 'bankAccounts' | 'creditCards'> = {
    bankAccounts: [
      mkRecord('Maybank Savings', '4200', isoDaysAgo(20)),
      mkRecord('CIMB Current', '1800', isoDaysAgo(7)),
    ],
    creditCards: [
      mkRecord('Maybank Visa', '650', isoDaysAgo(10)),
    ],
  };

  const transactions: Transaction[] = [
    mkTx('trial-1', 'Grab', 'Transport', -18.5, 1, { payment: 'GrabPay', brand: 'grab' }),
    mkTx('trial-2', 'Starbucks', 'Food & Drink', -15.9, 2),
    mkTx('trial-3', 'Decathlon', 'Lifestyle', -238, 5, { tax: true, reliefKey: 'life_general' }),
    mkTx('trial-4', 'Guardian Pharmacy', 'Health', -42.3, 6, { tax: true, reliefKey: 'med_self', brand: 'guardian' }),
    mkTx('trial-5', 'Tesco', 'Shopping', -96.4, 8),
    mkTx('trial-6', 'Salary', 'Income', 5500, 14, { payment: 'Bank Transfer' }),
  ];

  const buckets = defaultBuckets().map((b) => {
    if (b.key === 'fixed') return { ...b, categories: [mkCategory('Housing', 1500, [mkItem('Rent', 1500)])] };
    if (b.key === 'flexible') return { ...b, categories: [mkCategory('Food & Drink', 600, [mkItem('Groceries + dining', 340)])] };
    return b;
  });

  const subs: Subscription[] = [
    { name: 'Netflix', amount: '54.90', frequency: 'Monthly', startDate: isoDaysAgo(40), nextPayment: isoIn(20), method: 'Maybank Visa', category: 'Entertainment' },
  ];

  return { manual, transactions, buckets, subs };
}

function isoIn(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function emptyTrialData(): TrialData {
  return { manual: { bankAccounts: [], creditCards: [] }, transactions: [], buckets: defaultBuckets(), subs: [] };
}
