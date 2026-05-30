import { NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/google/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getStoredSession();
  return NextResponse.json({ connected: !!session });
}
