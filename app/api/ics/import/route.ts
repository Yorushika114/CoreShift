import { NextRequest, NextResponse } from 'next/server';
import { parseIcs } from '@/lib/ics';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    return NextResponse.json({ error: '不是有效的 .ics 文件' }, { status: 400 });
  }

  const events = parseIcs(text);
  if (events.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  let imported = 0;
  let skipped = 0;

  for (const ev of events) {
    const existing = await prisma.event.findFirst({ where: { icsUid: ev.uid } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.event.create({
      data: {
        title: ev.title,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay,
        color: 'blue',
        icsUid: ev.uid,
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
