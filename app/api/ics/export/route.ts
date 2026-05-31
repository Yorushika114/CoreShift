import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateIcs } from '@/lib/ics';
import { requireAuth, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  const events = await prisma.event.findMany({ where: { userId: auth.userId }, orderBy: { startAt: 'asc' } });
  const icsContent = generateIcs(events);

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="coreshift-export.ics"',
    },
  });
}
