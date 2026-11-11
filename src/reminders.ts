import { getCategory, goalProgress, shiftDay, type Asset, type Goal } from './finance.ts';
import { dueDates, type Recurring } from './recurring.ts';

export type Reminder = {
  /** Stable per event, so the same reminder is never planned twice. */
  id: string;
  /** Day to show it, "YYYY-MM-DD". */
  date: string;
  title: string;
  body: string;
};

/** How far ahead reminders are planned; the app re-plans every time it opens. */
export const REMINDER_HORIZON_DAYS = 30;
/** Phones cap pending notifications (iOS: 64), so keep well below that. */
export const MAX_REMINDERS = 30;

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
};

/**
 * Reminders for the coming days: recurring transactions waiting for confirmation, debts and loans
 * falling due, deposits maturing, goal deadlines and goal contributions not yet made this period.
 * Only days after `today` are planned, soonest first.
 */
export function planReminders(
  data: { assets: Asset[]; goals: Goal[]; recurring: Recurring[] },
  today: string,
  now = new Date(),
): Reminder[] {
  const until = shiftDay(today, REMINDER_HORIZON_DAYS);
  const out: Reminder[] = [];
  const add = (r: Reminder) => {
    if (r.date > today && r.date <= until) out.push(r);
  };

  for (const rule of data.recurring) {
    if (!rule.active || rule.auto) continue;
    for (const date of dueDates(rule, until)) {
      add({
        id: `recurring:${rule.id}:${date}`,
        date,
        title: 'Khoản định kỳ đến hạn',
        body: `${rule.note || 'Giao dịch định kỳ'} đến hạn hôm nay. Mở app để ghi nhận.`,
      });
    }
  }

  for (const asset of data.assets) {
    if (!asset.dueDate) continue;
    const kind = getCategory(asset.category).label.toLowerCase();
    if (asset.category === 'debt' || asset.category === 'lent') {
      const what = asset.category === 'debt' ? 'Khoản nợ' : 'Khoản cho vay';
      add({
        id: `due-soon:${asset.id}:${asset.dueDate}`,
        date: shiftDay(asset.dueDate, -3),
        title: `${what} sắp đến hạn`,
        body: `"${asset.name}" đến hạn ngày ${shortDate(asset.dueDate)}.`,
      });
      add({
        id: `due:${asset.id}:${asset.dueDate}`,
        date: asset.dueDate,
        title: `${what} đến hạn hôm nay`,
        body: `"${asset.name}" đến hạn hôm nay.`,
      });
    } else {
      add({
        id: `maturity:${asset.id}:${asset.dueDate}`,
        date: asset.dueDate,
        title: 'Khoản gửi đáo hạn',
        body: `"${asset.name}" (${kind}) đáo hạn hôm nay. Hãy quyết định tái tục hay rút về.`,
      });
    }
  }

  for (const goal of data.goals) {
    const p = goalProgress(goal, now);
    if (p.remaining === 0) continue;
    add({
      id: `goal-deadline:${goal.id}:${goal.deadline}`,
      date: shiftDay(goal.deadline, -7),
      title: 'Mục tiêu sắp đến hạn',
      body: `"${goal.name}" còn 7 ngày nữa là đến hạn.`,
    });
    if (goal.type === 'recurring' && !p.contributedThisPeriod) {
      add({
        id: `goal-contribute:${goal.id}:${shiftDay(today, 1)}`,
        date: shiftDay(today, 1),
        title: 'Nhắc góp mục tiêu',
        body: `Bạn chưa góp cho "${goal.name}" trong ${p.currentPeriodLabel}.`,
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, MAX_REMINDERS);
}
