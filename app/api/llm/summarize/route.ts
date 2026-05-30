import { NextRequest } from 'next/server';
import type { CalendarEvent } from '@/types';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    question?: unknown;
    events?: unknown;
    lang?: unknown;
    rangeStart?: unknown;
    rangeEnd?: unknown;
  };

  const { question, events, lang, rangeStart, rangeEnd } = body;

  if (!question || typeof question !== 'string') {
    return new Response('Missing question', { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response('LLM not configured', { status: 503 });
  }

  const eventList = Array.isArray(events) ? (events as CalendarEvent[]) : [];
  const eventsText = eventList.length === 0
    ? '(this time range has no events)'
    : eventList.map(e => {
        const start = new Date(e.startAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const end = e.endAt
          ? ` → ${new Date(e.endAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
          : '';
        return `- ${e.title}: ${start}${end}`;
      }).join('\n');

  const isEn = lang === 'en-US';

  const systemPrompt = isEn
    ? 'You are a helpful calendar assistant. Answer the user\'s question about their schedule concisely in English. 1-2 sentences maximum.'
    : '你是一个日历助手。用简洁自然的中文回答用户关于日程的问题。最多2句话。';

  const rangeDesc = `${rangeStart ?? '?'} to ${rangeEnd ?? '?'}`;
  const userMessage = isEn
    ? `User question: "${question}"\n\nCalendar events (${rangeDesc}):\n${eventsText}`
    : `用户问题：「${question}」\n\n日程安排（${rangeDesc}）：\n${eventsText}`;

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 256,
      }),
    });

    if (!upstream.ok) {
      console.error('[LLM summarize] upstream error', upstream.status);
      return new Response('LLM upstream error', { status: 502 });
    }

    const data = await upstream.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const summary = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ summary });
  } catch (err) {
    console.error('[LLM summarize] error', err);
    return new Response('LLM request failed', { status: 502 });
  }
}
