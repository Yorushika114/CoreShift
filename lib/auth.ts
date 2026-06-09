import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function requireAuth(request: NextRequest): Promise<{ userId: string; visitorId: string } | null> {
  const visitorId = request.cookies.get('visitor_id')?.value;
  if (!visitorId) return null;

  const session = await prisma.session.findFirst({
    where: { visitorId, googleSub: { not: '' } },
    orderBy: { createdAt: 'desc' },
  });

  // Google 已登录：用 googleSub 作为 userId（跨设备数据隔离）
  if (session) return { userId: session.googleSub, visitorId };

  // 未登录 Google：降级用 visitorId 作为 userId（单设备本地模式）
  return { userId: visitorId, visitorId };
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
