import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { deleteEvents } = await request.json().catch(() => ({ deleteEvents: false }));

  await prisma.session.deleteMany();

  if (deleteEvents) {
    await prisma.event.deleteMany({ where: { googleEventId: { not: null } } });
  }
  // 保留事件时不清除 googleEventId——重连后 syncFromGoogle 可用此字段去重，避免产生重复事件

  return NextResponse.json({ ok: true });
}
