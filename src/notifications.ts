import { Platform } from 'react-native';
import type { Reminder } from './reminders';

type Notifications = typeof import('expo-notifications');

const CHANNEL = 'reminders';
const DAILY_ID = 'daily-reminder';
/** Hour of the day event reminders are shown. */
const EVENT_HOUR = 8;

let cached: Notifications | null | undefined;

/** The notifications module, or null where it is unavailable (web, or a build without it). */
function load(): Notifications | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') return (cached = null);
  try {
    // Loaded lazily so a missing native module never stops the app from starting.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as Notifications;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch (e) {
    console.warn('Notifications unavailable:', e);
    cached = null;
  }
  return cached;
}

export const notificationsSupported = () => load() !== null;

/** Asks for permission if needed. Returns whether notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const n = load();
  if (!n) return false;
  try {
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync(CHANNEL, {
        name: 'Nhắc nhở',
        importance: n.AndroidImportance.DEFAULT,
      });
    }
    const current = await n.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await n.requestPermissionsAsync()).granted;
  } catch (e) {
    console.warn('Notification permission failed:', e);
    return false;
  }
}

export type ReminderSettings = {
  daily: { enabled: boolean; hour: number; minute: number };
  events: Reminder[];
};

/**
 * Replaces everything this app has scheduled with the given plan. Safe to call often:
 * it does nothing without permission and never asks for it.
 */
export async function syncScheduledReminders(settings: ReminderSettings): Promise<void> {
  const n = load();
  if (!n) return;
  try {
    await n.cancelAllScheduledNotificationsAsync();
    if (!settings.daily.enabled && settings.events.length === 0) return;
    if (!(await n.getPermissionsAsync()).granted) return;

    if (settings.daily.enabled) {
      await n.scheduleNotificationAsync({
        identifier: DAILY_ID,
        content: { title: 'Ghi chi tiêu hôm nay', body: 'Dành một phút ghi lại các khoản thu chi trong ngày nhé.' },
        trigger: {
          type: n.SchedulableTriggerInputTypes.DAILY,
          hour: settings.daily.hour,
          minute: settings.daily.minute,
          channelId: CHANNEL,
        },
      });
    }
    for (const r of settings.events) {
      const [y, m, d] = r.date.split('-').map(Number);
      const date = new Date(y, m - 1, d, EVENT_HOUR, 0, 0);
      if (date.getTime() <= Date.now()) continue;
      await n.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
      });
    }
  } catch (e) {
    console.warn('Scheduling reminders failed:', e);
  }
}
