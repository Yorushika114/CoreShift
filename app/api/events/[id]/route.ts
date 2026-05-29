// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, deleteEvent } from '@/lib/calendar/events';
import { eventBus } from '@/lib/sse/eventBus';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const event = await updateEvent(params.id, body);
    eventBus.broadcast('updated');
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
    await deleteEvent(params.id);
    eventBus.broadcast('deleted');
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
