import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  const { selectedCalendarIds, defaultWriteCalendarId, syncDirection } = await request.json().catch(() => ({}));

  if (!Array.isArray(selectedCalendarIds) || selectedCalendarIds.length === 0) {
    return NextResponse.json({ error: 'selectedCalendarIds required' }, { status: 400 });
  }

  const validDirections = ['pull', 'push', 'both'];
  const direction = validDirections.includes(syncDirection) ? syncDirection : 'both';

  await prisma.session.updateMany({
    where: { visitorId: visitorId ?? '' },
    data: {
      selectedCalendarIds: JSON.stringify(selectedCalendarIds),
      defaultWriteCalendarId: defaultWriteCalendarId ?? 'primary',
      syncDirection: direction,
    },
  });

  return NextResponse.json({ ok: true });
}
