import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  if (visitorId) {
    await prisma.session.deleteMany({ where: { visitorId } });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('visitor_id', '', { maxAge: 0, path: '/' });
  return response;
}
