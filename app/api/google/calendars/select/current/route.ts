import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  const session = await getStoredSession(visitorId);
  if (!session) return NextResponse.json({ syncDirection: 'both' });
  return NextResponse.json({
    syncDirection: session.syncDirection ?? 'both',
  });
}
