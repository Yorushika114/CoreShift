import { NextResponse } from 'next/server';
import { syncFromGoogle } from '@/lib/google/calendar';
import { eventBus } from '@/lib/sse/eventBus';

export async function POST() {
  try {
    const result = await syncFromGoogle();
    if (result.pulled > 0 || result.pushed > 0) {
      eventBus.broadcast('synced');
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('Sync failed:', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
