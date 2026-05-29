import type { CalendarEvent } from '@/types';

type ReminderCallback = (event: CalendarEvent) => void;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners: ReminderCallback[] = [];

export const reminderService = {
  onFire(cb: ReminderCallback) {
    listeners.push(cb);
    return () => {
      const i = listeners.indexOf(cb);
      if (i !== -1) listeners.splice(i, 1);
    };
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;
    return Notification.requestPermission();
  },

  scheduleAll(events: CalendarEvent[]) {
    timers.forEach(t => clearTimeout(t));
    timers.clear();

    const now = Date.now();
    for (const event of events) {
      if (!event.reminderAt) continue;
      const delay = new Date(event.reminderAt).getTime() - now;
      if (delay < 0) continue;
      const timer = setTimeout(() => {
        this.fire(event);
        timers.delete(event.id);
      }, delay);
      timers.set(event.id, timer);
    }
  },

  cancel(id: string) {
    const t = timers.get(id);
    if (t) { clearTimeout(t); timers.delete(id); }
  },

  async fire(event: CalendarEvent) {
    // In-app toast (always works)
    listeners.forEach(cb => cb(event));

    // Browser notification
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;

    const start = new Date(event.startAt);
    const timeStr = start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    new Notification(`🔔 ${event.title}`, {
      body: `活动将于 ${timeStr} 开始`,
      tag: event.id,
    });
  },
};
