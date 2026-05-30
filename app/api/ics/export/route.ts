import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateIcs } from '@/lib/ics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const events = await prisma.event.findMany({ orderBy: { startAt: 'asc' } });
  const icsContent = generateIcs(events);

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="coreshift-export.ics"',
    },
  });
}
