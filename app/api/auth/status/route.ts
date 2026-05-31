import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/google/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let visitorId = request.cookies.get('visitor_id')?.value;
  const isNew = !visitorId;
  if (!visitorId) visitorId = randomUUID();

  const session = await getStoredSession(visitorId);
  const response = NextResponse.json({ connected: !!session });

  if (isNew) {
    response.cookies.set('visitor_id', visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 * 10,
      path: '/',
    });
  }

  return response;
}
