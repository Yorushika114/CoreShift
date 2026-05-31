import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  const { selectedCalendarIds, defaultWriteCalendarId } = await request.json().catch(() => ({}));

  if (!Array.isArray(selectedCalendarIds) || selectedCalendarIds.length === 0) {
    return NextResponse.json({ error: 'selectedCalendarIds required' }, { status: 400 });
  }

  await prisma.session.updateMany({
    where: { visitorId: visitorId ?? '' },
    data: {
      selectedCalendarIds: JSON.stringify(selectedCalendarIds),
      defaultWriteCalendarId: defaultWriteCalendarId ?? 'primary',
    },
  });

  return NextResponse.json({ ok: true });
}
