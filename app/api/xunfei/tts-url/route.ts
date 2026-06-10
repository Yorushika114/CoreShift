import { generateTtsSignedUrl } from '@/lib/voice/xunfeiSign';

export async function GET() {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    return Response.json({ error: 'Xunfei TTS not configured' }, { status: 503 });
  }

  const url = generateTtsSignedUrl(appId, apiKey, apiSecret);
  return Response.json({ url, appId });
}
