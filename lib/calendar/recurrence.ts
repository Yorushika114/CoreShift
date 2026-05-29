// lib/calendar/recurrence.ts
import type { CalendarEvent } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.recurrence) {
      result.push(event);
      continue;
    }

    const stepMs = event.recurrence === 'daily' ? DAY_MS : WEEK_MS;
    if (event.recurrence === 'daily' || event.recurrence === 'weekly') {
      const originalStart = new Date(event.startAt);
      const originalEnd = event.endAt ? new Date(event.endAt) : null;
      const duration = originalEnd
        ? originalEnd.getTime() - originalStart.getTime()
        : 60 * 60 * 1000;
      // Preserve the reminder offset (ms before start) so each instance gets the right reminderAt
      const reminderOffset = event.reminderAt
        ? originalStart.getTime() - new Date(event.reminderAt).getTime()
        : null;

      // Find first instance >= rangeStart
      let instanceStart = new Date(originalStart);
      if (instanceStart < rangeStart) {
        const stepsForward = Math.ceil(
          (rangeStart.getTime() - instanceStart.getTime()) / stepMs,
        );
        instanceStart = new Date(instanceStart.getTime() + stepsForward * stepMs);
      }

      while (instanceStart <= rangeEnd) {
        const virtualId = `${event.id}::${instanceStart.toISOString()}`;
        result.push({
          ...event,
          id: virtualId,
          startAt: instanceStart.toISOString(),
          endAt: new Date(instanceStart.getTime() + duration).toISOString(),
          reminderAt: reminderOffset !== null
            ? new Date(instanceStart.getTime() - reminderOffset).toISOString()
            : event.reminderAt,
        });
        instanceStart = new Date(instanceStart.getTime() + stepMs);
      }
    }
  }

  return result;
}

/** Strip the virtual-instance suffix to get the real DB event ID. */
export function realEventId(id: string): string {
  return id.includes('::') ? id.split('::')[0] : id;
}
