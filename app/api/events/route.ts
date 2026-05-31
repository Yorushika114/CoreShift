// app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getEvents, createEvent } from '@/lib/calendar/events';
import { eventBus } from '@/lib/sse/eventBus';
import { pushEventToGoogle } from '@/lib/google/calendar';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (start && isNaN(new Date(start).getTime()))
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
  if (end && isNaN(new Date(end).getTime()))
    return NextResponse.json({ error: 'Invalid end date' }, { status: 400 });
  try {
    const events = await getEvents(
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined
    );
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title || !body.startAt) {
      return NextResponse.json({ error: 'title and startAt are required' }, { status: 400 });
    }
    const event = await createEvent(body);
    eventBus.broadcast('created');

    const visitorId = request.cookies.get('visitor_id')?.value;
    // Real-time push to Google Calendar (non-blocking on failure)
    pushEventToGoogle(event, visitorId)
      .then(async (googleId) => {
        if (googleId) {
          await prisma.event.update({
            where: { id: event.id },
            data: { googleEventId: googleId, googleUpdatedAt: new Date() },
          });
        }
      })
      .catch((e) => console.error('Google push failed:', e));

    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
