import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { selectedCalendarIds, defaultWriteCalendarId } = await request.json().catch(() => ({}));

  if (!Array.isArray(selectedCalendarIds) || selectedCalendarIds.length === 0) {
    return NextResponse.json({ error: 'selectedCalendarIds required' }, { status: 400 });
  }

  await prisma.session.updateMany({
    data: {
      selectedCalendarIds: JSON.stringify(selectedCalendarIds),
      defaultWriteCalendarId: defaultWriteCalendarId ?? 'primary',
    },
  });

  return NextResponse.json({ ok: true });
}
