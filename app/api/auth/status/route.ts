import { NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/google/auth';

export async function GET() {
  const session = await getStoredSession();
  return NextResponse.json({ connected: !!session });
}
