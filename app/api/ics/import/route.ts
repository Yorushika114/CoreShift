import { NextRequest, NextResponse } from 'next/server';
import { parseIcs } from '@/lib/ics';
import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/sse/eventBus';
import { requireAuth, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  const text = await request.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    return NextResponse.json({ error: '不是有效的 .ics 文件' }, { status: 400 });
  }

  let events;
  try {
    events = parseIcs(text);
  } catch (e) {
    return NextResponse.json({ error: '解析 .ics 文件失败' }, { status: 400 });
  }

  if (events.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  let imported = 0;
  let skipped = 0;

  for (const ev of events) {
    try {
      const existing = await prisma.event.findFirst({ where: { icsUid: ev.uid } });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.event.create({
        data: {
          userId: auth.userId,
          title: ev.title,
          startAt: ev.startAt,
          endAt: ev.endAt,
          allDay: ev.allDay,
          color: 'blue',
          icsUid: ev.uid,
          icsSeriesUid: ev.seriesUid ?? null,
        },
      });
      imported++;
    } catch (e) {
      console.error(`ICS import: skipping event "${ev.title}" (${ev.uid}):`, e);
      skipped++;
    }
  }

  if (imported > 0) {
    eventBus.broadcast('synced');
  }

  return NextResponse.json({ imported, skipped });
}
