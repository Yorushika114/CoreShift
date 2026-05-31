import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function requireAuth(request: NextRequest): Promise<{ userId: string; visitorId: string } | null> {
  const visitorId = request.cookies.get('visitor_id')?.value;
  if (!visitorId) return null;
  const session = await prisma.session.findFirst({
    where: { visitorId, googleSub: { not: '' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!session) return null;
  return { userId: session.googleSub, visitorId };
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
