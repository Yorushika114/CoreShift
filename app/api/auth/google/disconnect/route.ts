import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  const { deleteEvents } = await request.json().catch(() => ({ deleteEvents: false }));

  if (visitorId) {
    await prisma.session.deleteMany({ where: { visitorId } });
  }

  if (deleteEvents) {
    await prisma.event.deleteMany({ where: { googleEventId: { not: null } } });
  }
  // 保留事件时不清除 googleEventId——重连后 syncFromGoogle 可用此字段去重，避免产生重复事件

  return NextResponse.json({ ok: true });
}
