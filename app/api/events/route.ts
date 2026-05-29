// app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getEvents, createEvent } from '@/lib/calendar/events';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
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
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
