// lib/calendar/events.ts
import { prisma } from '@/lib/prisma';
import type { CalendarEvent } from '@/types';

function toCalendarEvent(e: {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reminderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceText: string | null;
}): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    reminderAt: e.reminderAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    sourceText: e.sourceText ?? null,
  };
}

export async function getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
  const events = await prisma.event.findMany({
    where: startDate || endDate
      ? { startAt: { gte: startDate, lte: endDate } }
      : undefined,
    orderBy: { startAt: 'asc' },
  });
  return events.map(toCalendarEvent);
}

export async function createEvent(
  data: Pick<CalendarEvent, 'title' | 'startAt'> &
    Partial<Pick<CalendarEvent, 'endAt' | 'reminderAt' | 'sourceText'>>
): Promise<CalendarEvent> {
  const event = await prisma.event.create({
    data: {
      title: data.title,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      sourceText: data.sourceText ?? null,
    },
  });
  return toCalendarEvent(event);
}

export async function updateEvent(
  id: string,
  data: Partial<Pick<CalendarEvent, 'title' | 'startAt' | 'endAt' | 'reminderAt' | 'sourceText'>>
): Promise<CalendarEvent> {
  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.startAt !== undefined && { startAt: new Date(data.startAt) }),
      ...(data.endAt !== undefined && { endAt: data.endAt ? new Date(data.endAt) : null }),
      ...(data.reminderAt !== undefined && { reminderAt: data.reminderAt ? new Date(data.reminderAt) : null }),
      ...(data.sourceText !== undefined && { sourceText: data.sourceText }),
    },
  });
  return toCalendarEvent(event);
}

export async function deleteEvent(id: string): Promise<void> {
  await prisma.event.delete({ where: { id } });
}
