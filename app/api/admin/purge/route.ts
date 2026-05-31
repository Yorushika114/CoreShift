import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-purge-secret');
  if (secret !== process.env.PURGE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await prisma.event.deleteMany({});
  return NextResponse.json({ deleted: result.count });
}
