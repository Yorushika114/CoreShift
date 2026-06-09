import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  const body = await request.json() as {
    date: string;
    isDeleted?: boolean;
    title?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    reminderAt?: string | null;
    color?: string | null;
  };

  if (!body.date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id, userId: auth.userId },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const exception = await prisma.eventException.upsert({
    where: { eventId_date: { eventId: params.id, date: new Date(body.date) } },
    create: {
      eventId: params.id,
      date: new Date(body.date),
      isDeleted: body.isDeleted ?? false,
      title: body.title ?? null,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
      color: body.color ?? null,
    },
    update: {
      isDeleted: body.isDeleted ?? false,
      title: body.title ?? null,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
      color: body.color ?? null,
    },
  });

  return NextResponse.json(exception, { status: 201 });
}
