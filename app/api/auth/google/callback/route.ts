import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, saveTokens } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
  }

  await saveTokens(
    tokens.access_token,
    tokens.refresh_token,
    new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000)
  );

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? '';
  const baseUrl = redirectUri
    ? redirectUri.replace('/api/auth/google/callback', '')
    : (() => {
        const proto = request.headers.get('x-forwarded-proto') ?? 'https';
        const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
        return `${proto}://${host}`;
      })();
  return NextResponse.redirect(`${baseUrl}/setup/calendars`);
}
