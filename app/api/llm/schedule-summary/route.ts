import type { NextRequest } from 'next/server';
import type { CalendarEvent } from '@/types';

export async function POST(req: NextRequest | Request) {
  const body = await req.json() as {
    events?: unknown;
    lang?: unknown;
    rangeStart?: unknown;
    rangeEnd?: unknown;
    tz?: unknown;
  };

  const { events, lang, rangeStart, rangeEnd, tz } = body;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response('LLM not configured', { status: 503 });
  }

  if (typeof rangeStart !== 'string' || !rangeStart || typeof rangeEnd !== 'string' || !rangeEnd) {
    return new Response('Missing rangeStart or rangeEnd', { status: 400 });
  }

  const eventList = Array.isArray(events) ? (events as CalendarEvent[]) : [];
  const tzStr = typeof tz === 'string' ? tz : 'Asia/Shanghai';
  const isEn = lang === 'en-US';

  const eventsText = eventList.length === 0
    ? (isEn ? '(no events in this range)' : '（该时间段没有安排）')
    : eventList.map(e => {
        const start = new Date(e.startAt).toLocaleString(isEn ? 'en-US' : 'zh-CN', {
          timeZone: tzStr,
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: isEn,
        });
        const end = e.endAt
          ? ` → ${new Date(e.endAt).toLocaleString(isEn ? 'en-US' : 'zh-CN', {
              timeZone: tzStr,
              hour: '2-digit', minute: '2-digit', hour12: isEn,
            })}`
          : '';
        return `- ${e.title}: ${start}${end}`;
      }).join('\n');

  const systemPrompt = isEn
    ? `You are a helpful calendar assistant. Analyze the user's schedule and write a natural, conversational summary.

Write 2-4 sentences:
1. Describe what events are scheduled (mention actual titles and times)
2. Add a brief observation: is it a busy or light period? Any patterns (morning-heavy, back-to-back meetings, etc.)?

Rules:
- Write in English
- Be specific: mention event names and times
- Conversational tone, NOT a bullet list
- If no events: say so warmly and encourage the user`
    : `你是一个日历助手。分析用户的日程安排，用自然流畅的中文写一段摘要。

写2-4句话：
1. 描述有哪些安排（提到具体的事件名称和时间）
2. 加一句整体评估：这段时间忙不忙？有什么规律（上午集中/会议连续/比较空闲等）？

规则：
- 用中文回答
- 要具体：提到事件名称和时间
- 口语化自然，不要写成列表
- 如果没有安排：友好地告知，并鼓励用户`;

  const rangeDesc = `${rangeStart ?? '?'} to ${rangeEnd ?? '?'}`;
  const userMessage = isEn
    ? `Please summarize my schedule.\n\nEvents (${rangeDesc}):\n${eventsText}`
    : `请总结我的日程安排。\n\n安排（${rangeDesc}）：\n${eventsText}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      console.error('[schedule-summary] upstream error', upstream.status);
      return new Response('LLM upstream error', { status: 502 });
    }

    const data = await upstream.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const summary = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ summary });
  } catch (err) {
    console.error('[schedule-summary] error', err);
    return new Response('LLM request failed', { status: 502 });
  }
}
