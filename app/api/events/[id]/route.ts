// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, deleteEvent } from '@/lib/calendar/events';
import { eventBus } from '@/lib/sse/eventBus';
import { updateEventInGoogle, deleteEventFromGoogle } from '@/lib/google/calendar';
import { prisma } from '@/lib/prisma';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const event = await updateEvent(auth.userId, params.id, body);
    eventBus.broadcast('updated');

    prisma.event.findUnique({ where: { id: params.id }, select: { googleEventId: true, googleCalendarId: true } })
      .then(async (row) => {
        if (row?.googleEventId) {
          await updateEventInGoogle(row.googleEventId, event, row.googleCalendarId, auth.visitorId);
        }
      })
      .catch((e) => console.error('Google update failed:', e));

    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  try {
    const mode = request.nextUrl.searchParams.get('mode');
    const row = await prisma.event.findUnique({
      where: { id: params.id, userId: auth.userId },
      select: { googleEventId: true, googleCalendarId: true, icsSeriesUid: true, startAt: true },
    });

    if (mode === 'future' && row?.icsSeriesUid) {
      const futureRows = await prisma.event.findMany({
        where: { userId: auth.userId, icsSeriesUid: row.icsSeriesUid, startAt: { gte: row.startAt } },
        select: { id: true, googleEventId: true, googleCalendarId: true },
      });
      await prisma.event.deleteMany({
        where: { userId: auth.userId, icsSeriesUid: row.icsSeriesUid, startAt: { gte: row.startAt } },
      });
      eventBus.broadcast('deleted');
      for (const r of futureRows) {
        if (r.googleEventId) {
          deleteEventFromGoogle(r.googleEventId, r.googleCalendarId, auth.visitorId).catch((e) => console.error('Google delete failed:', e));
        }
      }
    } else {
      await deleteEvent(auth.userId, params.id);
      eventBus.broadcast('deleted');
      if (row?.googleEventId) {
        deleteEventFromGoogle(row.googleEventId, row.googleCalendarId, auth.visitorId).catch((e) => console.error('Google delete failed:', e));
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
