// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, deleteEvent } from '@/lib/calendar/events';
import { eventBus } from '@/lib/sse/eventBus';
import { updateEventInGoogle, deleteEventFromGoogle } from '@/lib/google/calendar';
import { getStoredSession } from '@/lib/google/auth';
import { prisma } from '@/lib/prisma';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  const mode = request.nextUrl.searchParams.get('mode');
  const instanceDateStr = params.id.includes('::') ? params.id.split('::')[1] : null;
  const realId = params.id.includes('::') ? params.id.split('::')[0] : params.id;

  try {
    const body = await request.json();

    if (mode === 'this' && !instanceDateStr) {
      return NextResponse.json({ error: 'Virtual instance ID required for mode=this' }, { status: 400 });
    }
    if (mode === 'future' && !instanceDateStr) {
      return NextResponse.json({ error: 'Virtual instance ID required for mode=future' }, { status: 400 });
    }

    if (mode === 'this' && instanceDateStr) {
      const ownerCheck = await prisma.event.findUnique({ where: { id: realId, userId: auth.userId } });
      if (!ownerCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

      const exception = await prisma.eventException.upsert({
        where: { eventId_date: { eventId: realId, date: new Date(instanceDateStr) } },
        create: {
          eventId: realId,
          date: new Date(instanceDateStr),
          isDeleted: false,
          title: body.title ?? null,
          startAt: body.startAt ? new Date(body.startAt) : null,
          endAt: body.endAt ? new Date(body.endAt) : null,
          reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
          color: body.color ?? null,
        },
        update: {
          isDeleted: false,
          title: body.title ?? null,
          startAt: body.startAt ? new Date(body.startAt) : null,
          endAt: body.endAt ? new Date(body.endAt) : null,
          reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
          color: body.color ?? null,
        },
      });
      eventBus.broadcast('updated');
      return NextResponse.json(exception);
    }

    if (mode === 'future' && instanceDateStr) {
      // 截断原系列，再创建新系列
      const instanceDate = new Date(instanceDateStr);
      const dayBefore = new Date(instanceDate.getTime() - 24 * 60 * 60 * 1000);
      const originalEvent = await prisma.event.findUnique({ where: { id: realId, userId: auth.userId } });
      if (!originalEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      await prisma.event.update({
        where: { id: realId, userId: auth.userId },
        data: { recurrenceEndAt: dayBefore },
      });
      const newEvent = await prisma.event.create({
        data: {
          userId: auth.userId,
          title: body.title ?? originalEvent.title,
          startAt: instanceDate,
          endAt: body.endAt ? new Date(body.endAt) : originalEvent.endAt,
          reminderAt: body.reminderAt ? new Date(body.reminderAt) : originalEvent.reminderAt,
          allDay: originalEvent.allDay,
          recurrence: originalEvent.recurrence,
          recurrenceEndAt: originalEvent.recurrenceEndAt,
          recurrenceCount: null, // 新系列不继承次数，用日期截断
          color: body.color ?? originalEvent.color,
          sourceText: originalEvent.sourceText,
        },
      });
      eventBus.broadcast('updated');
      return NextResponse.json(newEvent);
    }

    // mode === 'all' 或无 mode：更新整个系列
    const event = await updateEvent(auth.userId, realId, body);
    eventBus.broadcast('updated');

    prisma.event.findUnique({ where: { id: realId }, select: { googleEventId: true, googleCalendarId: true } })
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
    const instanceDateStr = params.id.includes('::') ? params.id.split('::')[1] : null;
    const realId = params.id.includes('::') ? params.id.split('::')[0] : params.id;

    if (mode === 'this' && !instanceDateStr) {
      return NextResponse.json({ error: 'Virtual instance ID required for mode=this' }, { status: 400 });
    }

    if (mode === 'this' && instanceDateStr) {
      const row = await prisma.event.findUnique({
        where: { id: realId, userId: auth.userId },
        select: { id: true },
      });
      if (!row) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

      await prisma.eventException.upsert({
        where: { eventId_date: { eventId: realId, date: new Date(instanceDateStr) } },
        create: { eventId: realId, date: new Date(instanceDateStr), isDeleted: true },
        update: { isDeleted: true },
      });
      eventBus.broadcast('deleted');
      return new NextResponse(null, { status: 204 });
    }

    if (mode === 'future') {
      if (instanceDateStr) {
        // 重复事件：截断 recurrenceEndAt 到该实例日期前一天
        const instanceDate = new Date(instanceDateStr);
        const dayBefore = new Date(instanceDate.getTime() - 24 * 60 * 60 * 1000);
        const row2 = await prisma.event.findUnique({
          where: { id: realId, userId: auth.userId },
        });
        if (!row2) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        await prisma.event.update({
          where: { id: realId, userId: auth.userId },
          data: { recurrenceEndAt: dayBefore },
        });
        eventBus.broadcast('updated');
        return new NextResponse(null, { status: 204 });
      } else {
        // 原有 icsSeriesUid 逻辑
        const row = await prisma.event.findUnique({
          where: { id: realId, userId: auth.userId },
          select: { googleEventId: true, googleCalendarId: true, icsSeriesUid: true, startAt: true },
        });
        if (row?.icsSeriesUid) {
          const futureRows = await prisma.event.findMany({
            where: { userId: auth.userId, icsSeriesUid: row.icsSeriesUid, startAt: { gte: row.startAt } },
            select: { id: true, googleEventId: true, googleCalendarId: true },
          });
          await prisma.event.deleteMany({
            where: { userId: auth.userId, icsSeriesUid: row.icsSeriesUid, startAt: { gte: row.startAt } },
          });
          eventBus.broadcast('deleted');
          const session2 = await getStoredSession(auth.visitorId);
          const shouldSync = (session2?.syncDirection ?? 'both') !== 'pull';
          for (const r of futureRows) {
            if (r.googleEventId && shouldSync) {
              const pending = await prisma.pendingGoogleDelete.create({
                data: {
                  googleEventId: r.googleEventId,
                  googleCalendarId: r.googleCalendarId ?? null,
                  visitorId: auth.visitorId,
                  userId: auth.userId,
                },
              });
              deleteEventFromGoogle(r.googleEventId, r.googleCalendarId, auth.visitorId)
                .then(() => prisma.pendingGoogleDelete.delete({ where: { id: pending.id } }))
                .catch((e) => console.error('Google delete queued for retry:', e));
            }
          }
          return new NextResponse(null, { status: 204 });
        }
      }
    }

    // 默认：删除整个事件（mode === 'all' 或无 mode）
    const row = await prisma.event.findUnique({
      where: { id: realId, userId: auth.userId },
      select: { googleEventId: true, googleCalendarId: true },
    });
    await deleteEvent(auth.userId, realId);
    eventBus.broadcast('deleted');
    if (row?.googleEventId) {
      const session = await getStoredSession(auth.visitorId);
      if ((session?.syncDirection ?? 'both') !== 'pull') {
        const pending = await prisma.pendingGoogleDelete.create({
          data: {
            googleEventId: row.googleEventId,
            googleCalendarId: row.googleCalendarId ?? null,
            visitorId: auth.visitorId,
            userId: auth.userId,
          },
        });
        deleteEventFromGoogle(row.googleEventId, row.googleCalendarId, auth.visitorId)
          .then(() => prisma.pendingGoogleDelete.delete({ where: { id: pending.id } }))
          .catch((e) => console.error('Google delete queued for retry:', e));
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
