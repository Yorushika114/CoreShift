// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, deleteEvent } from '@/lib/calendar/events';
import { eventBus } from '@/lib/sse/eventBus';
import { updateEventInGoogle, deleteEventFromGoogle } from '@/lib/google/calendar';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const event = await updateEvent(params.id, body);
    eventBus.broadcast('updated');

    prisma.event.findUnique({ where: { id: params.id }, select: { googleEventId: true, googleCalendarId: true } })
      .then(async (row) => {
        if (row?.googleEventId) {
          await updateEventInGoogle(row.googleEventId, event, row.googleCalendarId);
        }
      })
      .catch((e) => console.error('Google update failed:', e));

    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const row = await prisma.event.findUnique({ where: { id: params.id }, select: { googleEventId: true, googleCalendarId: true } });
    await deleteEvent(params.id);
    eventBus.broadcast('deleted');

    if (row?.googleEventId) {
      deleteEventFromGoogle(row.googleEventId, row.googleCalendarId).catch((e) => console.error('Google delete failed:', e));
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
