import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  const { deleteEvents } = await request.json().catch(() => ({ deleteEvents: false }));

  await prisma.session.deleteMany({ where: { visitorId: auth.visitorId } });

  if (deleteEvents) {
    await prisma.event.deleteMany({ where: { userId: auth.userId, googleEventId: { not: null } } });
  }
  // 保留事件时不清除 googleEventId——重连后 syncFromGoogle 可用此字段去重，避免产生重复事件

  return NextResponse.json({ ok: true });
}
