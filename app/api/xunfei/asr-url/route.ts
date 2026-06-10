import { generateAsrSignedUrl } from '@/lib/voice/xunfeiSign';

export async function GET(request: Request) {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    return Response.json({ error: 'Xunfei ASR not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') ?? 'zh-CN';

  const url = generateAsrSignedUrl(apiKey, apiSecret);
  return Response.json({ url, appId, lang });
}
