import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth';
import { prisma } from '@/lib/prisma';
import type { CalendarEvent } from '@/types';

function toGoogleEvent(event: Partial<CalendarEvent>) {
  const isAllDay = event.allDay;
  const startDate = event.startAt?.split('T')[0];
  const endDate = event.endAt?.split('T')[0] ?? startDate;

  return {
    summary: event.title,
    start: isAllDay ? { date: startDate } : { dateTime: event.startAt, timeZone: 'Asia/Shanghai' },
    end: isAllDay
      ? { date: endDate }
      : { dateTime: event.endAt ?? event.startAt, timeZone: 'Asia/Shanghai' },
  };
}

export async function pushEventToGoogle(event: CalendarEvent): Promise<string | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;

  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: toGoogleEvent(event),
  });
  return res.data.id ?? null;
}

export async function updateEventInGoogle(googleEventId: string, event: Partial<CalendarEvent>): Promise<void> {
  const auth = await getAuthenticatedClient();
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.patch({
    calendarId: 'primary',
    eventId: googleEventId,
    requestBody: toGoogleEvent(event),
  });
}

export async function deleteEventFromGoogle(googleEventId: string): Promise<void> {
  const auth = await getAuthenticatedClient();
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
}

export async function syncFromGoogle(): Promise<{ pulled: number; pushed: number }> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { pulled: 0, pushed: 0 };

  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(timeMin.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + 6);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  const googleEvents = res.data.items ?? [];
  let pulled = 0;

  for (const gEvent of googleEvents) {
    if (!gEvent.id || !gEvent.summary) continue;
    const googleUpdatedAt = gEvent.updated ? new Date(gEvent.updated) : new Date();
    const startAt = gEvent.start?.dateTime ?? gEvent.start?.date;
    const endAt = gEvent.end?.dateTime ?? gEvent.end?.date;
    if (!startAt) continue;

    const existing = await prisma.event.findFirst({ where: { googleEventId: gEvent.id } });

    if (existing) {
      if (googleUpdatedAt > existing.updatedAt) {
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            title: gEvent.summary,
            startAt: new Date(startAt),
            endAt: endAt ? new Date(endAt) : null,
            allDay: !!gEvent.start?.date,
            googleUpdatedAt,
          },
        });
        pulled++;
      }
    } else {
      await prisma.event.create({
        data: {
          title: gEvent.summary,
          startAt: new Date(startAt),
          endAt: endAt ? new Date(endAt) : null,
          allDay: !!gEvent.start?.date,
          color: 'blue',
          googleEventId: gEvent.id,
          googleUpdatedAt,
        },
      });
      pulled++;
    }
  }

  // Push local events that haven't been synced to Google yet
  const localOnly = await prisma.event.findMany({ where: { googleEventId: null } });
  let pushed = 0;

  for (const event of localOnly) {
    try {
      const calEvent: CalendarEvent = {
        id: event.id,
        title: event.title,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt?.toISOString() ?? null,
        allDay: event.allDay,
        color: event.color,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      };
      const googleId = await pushEventToGoogle(calEvent);
      if (googleId) {
        await prisma.event.update({
          where: { id: event.id },
          data: { googleEventId: googleId, googleUpdatedAt: new Date() },
        });
        pushed++;
      }
    } catch (e) {
      console.error(`Failed to push event ${event.id} to Google:`, e);
    }
  }

  return { pulled, pushed };
}
