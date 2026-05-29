import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text?: unknown };

  if (!text || typeof text !== 'string') {
    return new Response('Missing text', { status: 400 });
  }

  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey || apiKey === 'your_fish_audio_api_key_here') {
    return new Response('TTS not configured', { status: 503 });
  }

  const body: Record<string, unknown> = {
    text,
    format: 'mp3',
    latency: 'normal',
  };

  const voiceId = process.env.FISH_AUDIO_VOICE_ID;
  if (voiceId) body.reference_id = voiceId;

  try {
    const upstream = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model: 's1',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[TTS] Fish Audio error', upstream.status, errText);
      return new Response('TTS upstream error', { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[TTS] fetch error', err);
    return new Response('TTS request failed', { status: 502 });
  }
}
