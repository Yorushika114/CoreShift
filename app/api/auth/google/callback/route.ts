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

  return NextResponse.redirect(new URL('/', request.url));
}
