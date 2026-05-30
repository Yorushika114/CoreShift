import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are a calendar voice command parser. Parse the user's input into a structured JSON object.

Current UTC time: {NOW}
User's local timezone: {TZ}
User's local date and time: {LOCAL_NOW}

CRITICAL: When the user says a time (e.g. "3 PM", "tomorrow at 7 PM"), they mean LOCAL time in {TZ}.
You MUST convert local time to UTC when outputting ISO 8601 strings.
Example: user in Asia/Shanghai (UTC+8) says "tomorrow at 7 PM" → output "2026-05-31T11:00:00.000Z" (19:00 local − 8h = 11:00 UTC).

Return ONLY valid JSON matching this exact structure (no markdown, no explanation).
Use null for missing optional fields — never write the word "undefined":
{
  "intent": "create",
  "title": "team meeting",
  "startAt": "2026-05-31T07:00:00.000Z",
  "endAt": null,
  "reminderAt": null,
  "queryRangeStart": null,
  "queryRangeEnd": null,
  "hasDate": true,
  "hasTime": true,
  "ambiguities": [],
  "clarificationNeeded": false,
  "clarificationQuestion": null
}

Rules:
- All datetime fields must be absolute ISO 8601 strings (e.g. "2026-05-30T15:00:00.000Z")
- For "query" intent: set queryRangeStart and queryRangeEnd to cover the range the user asks about. If no range specified, use today (00:00 to 23:59)
- For "summarize" intent: use when the user asks to summarize, review, or analyze their schedule (e.g. "总结这周行程", "analyze my week", "give me a summary of today"). Set queryRangeStart and queryRangeEnd to cover the requested range. Leave title/startAt/endAt/reminderAt as null.
- ambiguities: list any assumptions made (e.g. "No date mentioned, defaulted to today"). Use the same language as the user's input
- clarificationQuestion: only set if title is completely unidentifiable. Use the same language as the user's input
- Output language for all text fields must match the user's input language`;

export async function POST(req: NextRequest) {
  const body = await req.json() as { text?: unknown; lang?: unknown; now?: unknown; tz?: unknown };
  const { text, lang, now, tz } = body;

  if (!text || typeof text !== 'string') {
    return new Response('Missing text', { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response('LLM not configured', { status: 503 });
  }

  const nowStr = typeof now === 'string' ? now : new Date().toISOString();
  const tzStr = typeof tz === 'string' ? tz : 'Asia/Shanghai';
  const localNow = new Date(nowStr).toLocaleString('en-US', {
    timeZone: tzStr,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const systemPrompt = SYSTEM_PROMPT
    .replace(/\{NOW\}/g, nowStr)
    .replace(/\{TZ\}/g, tzStr)
    .replace('{LOCAL_NOW}', localNow);

  const langHint = lang === 'en-US'
    ? '\n\nThe user is speaking English. All text fields in the response must be in English.'
    : '\n\nThe user is speaking Chinese. All text fields in the response must be in Chinese.';

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? process.env.model ?? 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt + langHint },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      console.error('[LLM parse] upstream error', upstream.status);
      return new Response('LLM upstream error', { status: 502 });
    }

    const data = await upstream.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Response('Empty LLM response', { status: 502 });

    let parsed: Record<string, unknown>;
    try {
      // 部分模型会输出 JS 的 undefined，不是合法 JSON，预处理替换为 null
      const sanitized = content.replace(/:\s*undefined/g, ': null');
      parsed = JSON.parse(sanitized) as Record<string, unknown>;
    } catch {
      console.error('[LLM parse] malformed JSON from LLM:', content);
      return new Response('Invalid JSON from LLM', { status: 502 });
    }
    if (!Array.isArray(parsed.ambiguities)) parsed.ambiguities = [];

    return Response.json(parsed);
  } catch (err) {
    console.error('[LLM parse] error', err);
    return new Response('LLM request failed', { status: 502 });
  }
}
