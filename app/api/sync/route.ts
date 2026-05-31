import { NextRequest, NextResponse } from 'next/server';
import { syncFromGoogle } from '@/lib/google/calendar';
import { eventBus } from '@/lib/sse/eventBus';

export async function POST(request: NextRequest) {
  const visitorId = request.cookies.get('visitor_id')?.value;
  try {
    const result = await syncFromGoogle(visitorId);
    if (result.pulled > 0 || result.pushed > 0) {
      eventBus.broadcast('synced');
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Sync failed:', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
