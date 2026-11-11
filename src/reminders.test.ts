import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Asset, Goal } from './finance.ts';
import type { Recurring } from './recurring.ts';
import { MAX_REMINDERS, planReminders } from './reminders.ts';

const today = '2026-11-10';
const now = new Date(2026, 10, 10);
const rule = (patch: Partial<Recurring>): Recurring => ({
  id: 'r1',
  kind: 'expense',
  category: 'housing',
  amount: 5_000_000,
  note: 'Tiền nhà',
  frequency: 'monthly',
  startDate: '2026-11-15',
  nextDate: '2026-11-15',
  auto: false,
  active: true,
  ...patch,
});

test('plans a reminder for a recurring transaction waiting to be confirmed', () => {
  const list = planReminders({ assets: [], goals: [], recurring: [rule({})] }, today, now);
  assert.deepEqual(
    list.map((r) => [r.id, r.date]),
    [['recurring:r1:2026-11-15', '2026-11-15']],
  );
});

test('skips automatic and paused rules, and anything due today or earlier', () => {
  const rules = [
    rule({ id: 'a', auto: true }),
    rule({ id: 'b', active: false }),
    rule({ id: 'c', startDate: '2026-11-10', nextDate: '2026-11-10', frequency: 'yearly' }),
  ];
  assert.deepEqual(planReminders({ assets: [], goals: [], recurring: rules }, today, now), []);
});

test('reminds three days before and on the day a debt falls due, and when a deposit matures', () => {
  const assets: Asset[] = [
    { id: 'd', name: 'Vay bạn', category: 'debt', amount: 1_000_000, dueDate: '2026-11-20', updatedAt: '' },
    { id: 's', name: 'Sổ 6 tháng', category: 'saving', amount: 50_000_000, dueDate: '2026-11-25', updatedAt: '' },
    { id: 'far', name: 'Sổ dài', category: 'saving', amount: 1, dueDate: '2027-06-01', updatedAt: '' },
  ];
  const list = planReminders({ assets, goals: [], recurring: [] }, today, now);
  assert.deepEqual(
    list.map((r) => [r.id.split(':')[0], r.date]),
    [
      ['due-soon', '2026-11-17'],
      ['due', '2026-11-20'],
      ['maturity', '2026-11-25'],
    ],
  );
});

test('reminds about a goal deadline and a missed contribution, but not for finished goals', () => {
  const goals: Goal[] = [
    { id: 'g1', name: 'ETF', target: 10_000_000, saved: 1_000_000, deadline: '2026-11-30', type: 'recurring', recurringAmount: 400_000 },
    { id: 'g2', name: 'Xong', target: 100, saved: 100, deadline: '2026-11-30' },
    { id: 'g3', name: 'Đã góp', target: 1000, saved: 10, deadline: '2028-01-01', type: 'recurring', lastContributedAt: '2026-11-02' },
  ];
  const list = planReminders({ assets: [], goals, recurring: [] }, today, now);
  assert.deepEqual(
    list.map((r) => r.id),
    ['goal-contribute:g1:2026-11-11', 'goal-deadline:g1:2026-11-30'],
  );
  assert.equal(list[1].date, '2026-11-23');
});

test('never plans more than the cap', () => {
  const rules = Array.from({ length: 50 }, (_, i) => rule({ id: `r${i}`, frequency: 'weekly' }));
  assert.equal(planReminders({ assets: [], goals: [], recurring: rules }, today, now).length, MAX_REMINDERS);
});
