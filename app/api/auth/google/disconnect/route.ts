import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { deleteEvents } = await request.json().catch(() => ({ deleteEvents: false }));

  await prisma.session.deleteMany();

  if (deleteEvents) {
    await prisma.event.deleteMany({ where: { googleEventId: { not: null } } });
  } else {
    // 保留事件，清除 googleEventId 让它们变成纯本地事件
    await prisma.event.updateMany({
      where: { googleEventId: { not: null } },
      data: { googleEventId: null, googleUpdatedAt: null },
    });
  }

  return NextResponse.json({ ok: true });
}
