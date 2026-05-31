import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/google/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  if (!visitorId) {
    return NextResponse.json({ connected: false });
  }
  const session = await getStoredSession(visitorId);
  if (!session || !session.googleSub) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({ connected: true, email: session.email, userId: session.googleSub });
}
