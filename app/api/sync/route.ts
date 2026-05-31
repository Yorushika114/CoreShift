import { NextRequest, NextResponse } from 'next/server';
import { syncFromGoogle } from '@/lib/google/calendar';
import { eventBus } from '@/lib/sse/eventBus';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();

  try {
    const result = await syncFromGoogle(auth.visitorId, auth.userId);
    if (result.pulled > 0 || result.pushed > 0) {
      eventBus.broadcast('synced');
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Sync failed:', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
