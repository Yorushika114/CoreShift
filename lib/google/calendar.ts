import { google } from 'googleapis';
import { getAuthenticatedClient, getStoredSession } from './auth';
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

async function getDefaultWriteCalendarId(visitorId?: string): Promise<string> {
  const session = await getStoredSession(visitorId);
  return session?.defaultWriteCalendarId ?? 'primary';
}

async function getSelectedCalendarIds(visitorId?: string): Promise<string[]> {
  const session = await getStoredSession(visitorId);
  if (!session) return ['primary'];
  try {
    const ids = JSON.parse(session.selectedCalendarIds) as string[];
    return ids.length > 0 ? ids : ['primary'];
  } catch {
    return ['primary'];
  }
}

export async function pushEventToGoogle(event: CalendarEvent, visitorId?: string): Promise<string | null> {
  const auth = await getAuthenticatedClient(visitorId);
  if (!auth) return null;

  const calendarId = await getDefaultWriteCalendarId(visitorId);
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId,
    requestBody: toGoogleEvent(event),
  });
  return res.data.id ?? null;
}

export async function updateEventInGoogle(googleEventId: string, event: Partial<CalendarEvent>, googleCalendarId?: string | null, visitorId?: string): Promise<void> {
  const auth = await getAuthenticatedClient(visitorId);
  if (!auth) return;

  const calendarId = googleCalendarId ?? await getDefaultWriteCalendarId(visitorId);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    requestBody: toGoogleEvent(event),
  });
}

export async function deleteEventFromGoogle(googleEventId: string, googleCalendarId?: string | null, visitorId?: string): Promise<void> {
  const auth = await getAuthenticatedClient(visitorId);
  if (!auth) return;

  const calendarId = googleCalendarId ?? await getDefaultWriteCalendarId(visitorId);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId, eventId: googleEventId });
}

export async function syncFromGoogle(
  visitorId?: string,
  userId?: string,
  direction: 'pull' | 'push' | 'both' = 'both'
): Promise<{ pulled: number; pushed: number }> {
  const auth = await getAuthenticatedClient(visitorId);
  if (!auth || !userId) return { pulled: 0, pushed: 0 };

  const calendarIds = await getSelectedCalendarIds(visitorId);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(timeMin.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + 6);

  let pulled = 0;

  // 拉取阶段：仅 pull 或 both 时执行
  if (direction === 'pull' || direction === 'both') {
    for (const calendarId of calendarIds) {
      let calendarColor = '#4285f4';
      try {
        const calMeta = await calendar.calendarList.get({ calendarId });
        calendarColor = calMeta.data.backgroundColor ?? '#4285f4';
      } catch {
        // 获取日历颜色失败不阻断同步
      }

      const res = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 500,
      });

      const googleEvents = res.data.items ?? [];

      for (const gEvent of googleEvents) {
        if (!gEvent.id || !gEvent.summary) continue;
        const googleUpdatedAt = gEvent.updated ? new Date(gEvent.updated) : new Date();
        const startAt = gEvent.start?.dateTime ?? gEvent.start?.date;
        const endAt = gEvent.end?.dateTime ?? gEvent.end?.date;
        if (!startAt) continue;

        const existing = await prisma.event.findFirst({ where: { googleEventId: gEvent.id, userId } });

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
                googleCalendarId: calendarId,
                googleCalendarColor: calendarColor,
              },
            });
            pulled++;
          }
        } else {
          await prisma.event.create({
            data: {
              userId,
              title: gEvent.summary,
              startAt: new Date(startAt),
              endAt: endAt ? new Date(endAt) : null,
              allDay: !!gEvent.start?.date,
              color: 'blue',
              googleEventId: gEvent.id,
              googleUpdatedAt,
              googleCalendarId: calendarId,
              googleCalendarColor: calendarColor,
            },
          });
          pulled++;
        }
      }
    }
  }

  // 推送阶段：仅 push 或 both 时执行
  const localOnly = (direction === 'push' || direction === 'both')
    ? await prisma.event.findMany({ where: { userId, googleEventId: null } })
    : [];
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
      const googleId = await pushEventToGoogle(calEvent, visitorId);
      if (googleId) {
        const defaultCalId = await getDefaultWriteCalendarId(visitorId);
        await prisma.event.update({
          where: { id: event.id },
          data: {
            googleEventId: googleId,
            googleUpdatedAt: new Date(),
            googleCalendarId: defaultCalId,
          },
        });
        pushed++;
      }
    } catch (e) {
      console.error(`Failed to push event ${event.id} to Google:`, e);
    }
  }

  return { pulled, pushed };
}
