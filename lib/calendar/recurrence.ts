// lib/calendar/recurrence.ts
import type { CalendarEvent } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

type ExceptionRecord = {
  eventId: string;
  date: string; // ISO
  isDeleted: boolean;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  reminderAt?: string | null;
  color?: string | null;
};

/** 给某月某日加 N 个月，溢出时取当月最后一天 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // 溢出检测：setMonth 会自动进位（如 1月31日+1月 → 3月3日），需要修正
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // 退到上个月最后一天
  }
  return result;
}

export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: ExceptionRecord[] = [],
): CalendarEvent[] {
  const result: CalendarEvent[] = [];

  // 按 eventId 分组 exceptions，key = eventId, value = Map<isoDate, exception>
  const exMap = new Map<string, Map<string, ExceptionRecord>>();
  for (const ex of exceptions) {
    if (!exMap.has(ex.eventId)) exMap.set(ex.eventId, new Map());
    exMap.get(ex.eventId)!.set(ex.date, ex);
  }

  for (const event of events) {
    if (!event.recurrence) {
      result.push(event);
      continue;
    }

    const originalStart = new Date(event.startAt);
    const originalEnd = event.endAt ? new Date(event.endAt) : null;
    const duration = originalEnd
      ? originalEnd.getTime() - originalStart.getTime()
      : 60 * 60 * 1000;
    const reminderOffset = event.reminderAt
      ? originalStart.getTime() - new Date(event.reminderAt).getTime()
      : null;

    // 计算有效截止点
    // recurrenceEndAt 理解为"截止到那天结束"，扩展到当天 23:59:59.999
    let effectiveEnd = rangeEnd;
    if (event.recurrenceEndAt) {
      const rEnd = new Date(event.recurrenceEndAt);
      rEnd.setHours(23, 59, 59, 999);
      if (rEnd < effectiveEnd) effectiveEnd = rEnd;
    }

    const eventExceptions = exMap.get(event.id) ?? new Map<string, ExceptionRecord>();

    if (event.recurrence === 'daily' || event.recurrence === 'weekly') {
      const stepMs = event.recurrence === 'daily' ? DAY_MS : WEEK_MS;
      let instanceStart = new Date(originalStart);
      if (instanceStart < rangeStart) {
        const stepsForward = Math.ceil(
          (rangeStart.getTime() - instanceStart.getTime()) / stepMs,
        );
        instanceStart = new Date(instanceStart.getTime() + stepsForward * stepMs);
      }

      let count = 0;
      while (instanceStart <= effectiveEnd) {
        if (event.recurrenceCount !== null && event.recurrenceCount !== undefined && count >= event.recurrenceCount) break;

        const isoKey = instanceStart.toISOString();
        const ex = eventExceptions.get(isoKey);
        if (!ex || !ex.isDeleted) {
          result.push(buildInstance(event, instanceStart, duration, reminderOffset, ex));
        }
        instanceStart = new Date(instanceStart.getTime() + stepMs);
        count++;
      }
    } else if (event.recurrence === 'monthly') {
      let monthOffset = 0;
      let count = 0;
      while (true) {
        if (event.recurrenceCount !== null && event.recurrenceCount !== undefined && count >= event.recurrenceCount) break;
        const instanceStart = addMonths(originalStart, monthOffset);
        if (instanceStart > effectiveEnd) break;
        monthOffset++;
        if (instanceStart < rangeStart) { count++; continue; }

        const isoKey = instanceStart.toISOString();
        const ex = eventExceptions.get(isoKey);
        if (!ex || !ex.isDeleted) {
          result.push(buildInstance(event, instanceStart, duration, reminderOffset, ex));
        }
        count++;
      }
    }
  }

  return result;
}

function buildInstance(
  event: CalendarEvent,
  instanceStart: Date,
  duration: number,
  reminderOffset: number | null,
  ex?: ExceptionRecord | null,
): CalendarEvent {
  const virtualId = `${event.id}::${instanceStart.toISOString()}`;
  return {
    ...event,
    id: virtualId,
    title: ex?.title ?? event.title,
    startAt: ex?.startAt ?? instanceStart.toISOString(),
    endAt: ex?.endAt ?? new Date(instanceStart.getTime() + duration).toISOString(),
    reminderAt: ex?.reminderAt !== undefined
      ? ex.reminderAt
      : (reminderOffset !== null
          ? new Date(instanceStart.getTime() - reminderOffset).toISOString()
          : event.reminderAt),
    color: ex?.color ?? event.color,
  };
}

/** Strip the virtual-instance suffix to get the real DB event ID. */
export function realEventId(id: string): string {
  return id.includes('::') ? id.split('::')[0] : id;
}

/** 从虚拟 ID 提取实例的原始 startAt ISO 字符串，不存在时返回 null */
export function instanceDate(id: string): string | null {
  return id.includes('::') ? id.split('::')[1] : null;
}
