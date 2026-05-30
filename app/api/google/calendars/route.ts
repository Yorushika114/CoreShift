import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/google/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 });

  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.calendarList.list();

  const items = (res.data.items ?? []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? '',
    backgroundColor: c.backgroundColor ?? '#4285f4',
    accessRole: c.accessRole ?? 'reader',
    primary: c.primary ?? false,
  }));

  return NextResponse.json(items);
}
