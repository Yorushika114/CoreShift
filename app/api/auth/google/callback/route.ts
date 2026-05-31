import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createOAuth2Client, saveTokens } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const visitorId = params.get('state');

  if (!code || !visitorId) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();
  const googleSub = userInfo.id ?? '';
  const email = userInfo.email ?? '';

  await saveTokens(
    tokens.access_token,
    tokens.refresh_token,
    new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
    visitorId,
    googleSub,
    email,
  );

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? '';
  const baseUrl = redirectUri
    ? redirectUri.replace('/api/auth/google/callback', '')
    : (() => {
        const proto = request.headers.get('x-forwarded-proto') ?? 'https';
        const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
        return `${proto}://${host}`;
      })();

  const response = NextResponse.redirect(`${baseUrl}/setup/calendars`);
  response.cookies.set('visitor_id', visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365 * 10,
    path: '/',
  });
  return response;
}
