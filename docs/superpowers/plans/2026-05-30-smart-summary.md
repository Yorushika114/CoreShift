# Smart Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `summarize` intent to the voice overlay that generates a narrative AI summary (with light analysis) of the user's schedule for a given time range, triggered by voice/text input or quick buttons ("今天"/"本周"), with auto-TTS and a toggle to mute it.

**Architecture:** New `summarize` intent flows through: (1) LLM parse returns `intent: 'summarize'` with a time range, or quick buttons bypass parse and go directly to (2) fetch events in range, then (3) call new `/api/llm/schedule-summary` route with a richer prompt that generates a 2-4 sentence narrative + light analysis. Result is shown as a blue summary card (primary) above a collapsible event list (secondary). TTS auto-reads the summary unless muted by toggle.

**Tech Stack:** Next.js 14 App Router API routes, DeepSeek Chat API (OpenAI-compatible), React useState for TTS toggle + list collapse, existing `useTTS` hook, existing `fetchRange` helper in VoiceCommandOverlay.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `types/index.ts` | Modify | Add `'summarize'` to `Intent` union |
| `app/api/llm/parse/route.ts` | Modify | Add `summarize` intent rules to system prompt |
| `app/api/llm/schedule-summary/route.ts` | Create | Rich narrative summarization endpoint |
| `components/voice/VoiceCommandOverlay.tsx` | Modify | New result kind, quick buttons, TTS toggle, summarize UI |
| `__tests__/api/llm/schedule-summary.test.ts` | Create | API route unit tests |

---

### Task 1: Add `summarize` to `Intent` type + update LLM parse prompt

**Files:**
- Modify: `types/index.ts:16`
- Modify: `app/api/llm/parse/route.ts:31-35`

- [ ] **Step 1: Update `types/index.ts`**

Change line 16 from:
```ts
export type Intent = 'create' | 'delete' | 'query' | 'modify' | 'unknown';
```
To:
```ts
export type Intent = 'create' | 'delete' | 'query' | 'modify' | 'summarize' | 'unknown';
```

- [ ] **Step 2: Update the LLM parse system prompt rules in `app/api/llm/parse/route.ts`**

Find the `Rules:` section (currently ends at `- Output language for all text fields must match the user's input language`). Replace the entire rules block with:

```
Rules:
- All datetime fields must be absolute ISO 8601 strings (e.g. "2026-05-30T15:00:00.000Z")
- For "query" intent: set queryRangeStart and queryRangeEnd to cover the range the user asks about. If no range specified, use today (00:00 to 23:59)
- For "summarize" intent: use when the user asks to summarize, review, or analyze their schedule (e.g. "总结这周行程", "analyze my week", "give me a summary of today"). Set queryRangeStart and queryRangeEnd to cover the requested range. Leave title/startAt/endAt/reminderAt as null.
- ambiguities: list any assumptions made (e.g. "No date mentioned, defaulted to today"). Use the same language as the user's input
- clarificationQuestion: only set if title is completely unidentifiable. Use the same language as the user's input
- Output language for all text fields must match the user's input language
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `Intent` or `ParsedCommand`.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts app/api/llm/parse/route.ts
git commit -m "feat: Intent 类型新增 summarize，更新 LLM parse 提示词"
```

---

### Task 2: Create `/api/llm/schedule-summary` route

**Files:**
- Create: `app/api/llm/schedule-summary/route.ts`
- Create: `__tests__/api/llm/schedule-summary.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `__tests__/api/llm/schedule-summary.test.ts`:

```ts
// Tests for /api/llm/schedule-summary route
// We test the handler logic by mocking fetch (the DeepSeek upstream call).

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Next.js route handlers use NextRequest — mock it minimally.
function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/llm/schedule-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/llm/schedule-summary', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('returns 503 when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const { POST } = await import('@/app/api/llm/schedule-summary/route');
    const req = makeRequest({ events: [], lang: 'zh-CN', rangeStart: '2026-05-26T00:00:00.000Z', rangeEnd: '2026-06-01T23:59:59.999Z' });
    const res = await POST(req as never);
    expect(res.status).toBe(503);
  });

  it('returns { summary } on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '本周你有2个安排，比较轻松。' } }],
      }),
    });
    const { POST } = await import('@/app/api/llm/schedule-summary/route');
    const req = makeRequest({
      events: [
        { id: '1', title: '组会', startAt: '2026-05-27T09:00:00.000Z', createdAt: '', updatedAt: '' },
        { id: '2', title: '算法课', startAt: '2026-05-29T14:00:00.000Z', createdAt: '', updatedAt: '' },
      ],
      lang: 'zh-CN',
      rangeStart: '2026-05-26T00:00:00.000Z',
      rangeEnd: '2026-06-01T23:59:59.999Z',
      tz: 'Asia/Shanghai',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { summary: string };
    expect(body.summary).toBe('本周你有2个安排，比较轻松。');
  });

  it('returns { summary } for empty events', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'No events this week — enjoy the free time!' } }],
      }),
    });
    const { POST } = await import('@/app/api/llm/schedule-summary/route');
    const req = makeRequest({
      events: [],
      lang: 'en-US',
      rangeStart: '2026-05-26T00:00:00.000Z',
      rangeEnd: '2026-06-01T23:59:59.999Z',
      tz: 'America/New_York',
    });
    const res = await POST(req as never);
    const body = await res.json() as { summary: string };
    expect(body.summary).toBe('No events this week — enjoy the free time!');
  });

  it('returns 502 when upstream fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const { POST } = await import('@/app/api/llm/schedule-summary/route');
    const req = makeRequest({ events: [], lang: 'zh-CN', rangeStart: '', rangeEnd: '' });
    const res = await POST(req as never);
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test __tests__/api/llm/schedule-summary.test.ts 2>&1 | tail -15
```
Expected: FAIL — `Cannot find module '@/app/api/llm/schedule-summary/route'`

- [ ] **Step 3: Create `app/api/llm/schedule-summary/route.ts`**

```ts
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

  const rangeDesc = `${rangeStart ?? ''} to ${rangeEnd ?? ''}`;
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
```

- [ ] **Step 4: Run tests again to verify they pass**

```bash
pnpm test __tests__/api/llm/schedule-summary.test.ts 2>&1 | tail -15
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
pnpm test 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/llm/schedule-summary/route.ts __tests__/api/llm/schedule-summary.test.ts
git commit -m "feat: 新增 /api/llm/schedule-summary 行程叙述性摘要 API"
```

---

### Task 3: Update VoiceCommandOverlay — summarize result + TTS toggle + quick buttons

**Files:**
- Modify: `components/voice/VoiceCommandOverlay.tsx`

This task has many interconnected changes. Apply them in order.

- [ ] **Step 1: Add `summarize` result kind to the `Result` union (around line 26-31)**

Current `Result` type:
```ts
type Result =
  | { kind: 'notfound'; intent: 'delete' | 'modify' }
  | { kind: 'delete'; events: CalendarEvent[]; approximate?: boolean }
  | { kind: 'modify-pick'; events: CalendarEvent[]; pick: (e: CalendarEvent) => void; approximate?: boolean }
  | { kind: 'query'; date: Date; events: CalendarEvent[]; aiSummary?: string }
  | { kind: 'create-preview'; parsed: ParsedCommand; original: string };
```

Replace with:
```ts
type Result =
  | { kind: 'notfound'; intent: 'delete' | 'modify' }
  | { kind: 'delete'; events: CalendarEvent[]; approximate?: boolean }
  | { kind: 'modify-pick'; events: CalendarEvent[]; pick: (e: CalendarEvent) => void; approximate?: boolean }
  | { kind: 'query'; date: Date; events: CalendarEvent[]; aiSummary?: string }
  | { kind: 'summarize'; summary: string; events: CalendarEvent[]; rangeLabel: string }
  | { kind: 'create-preview'; parsed: ParsedCommand; original: string };
```

- [ ] **Step 2: Add `ttsEnabled` and `summaryListOpen` state (after line 73 `const [lang, setLang]`)**

After `const [lang, setLang] = useState<'zh-CN' | 'en-US'>('zh-CN');`, add:
```ts
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [summaryListOpen, setSummaryListOpen] = useState(false);
```

- [ ] **Step 3: Add `handleSummary` function (add after the `handleDelete` function, around line 225)**

Add this new function:
```ts
  async function handleSummary(range: 'today' | 'week') {
    setActionError(null);
    setResult(null);
    setSummaryListOpen(false);
    setBusy(true);

    const now = new Date();
    let fetchStart: Date;
    let fetchEnd: Date;
    let rangeLabel: string;

    if (range === 'today') {
      [fetchStart, fetchEnd] = dayRange(now);
      rangeLabel = lang === 'en-US' ? 'Today' : '今天';
    } else {
      const day = now.getDay(); // 0=Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
      fetchEnd = new Date(fetchStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      rangeLabel = lang === 'en-US' ? 'This Week' : '本周';
    }

    try {
      const events = await fetchRange([fetchStart, fetchEnd]);
      const summaryRes = await fetch('/api/llm/schedule-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          lang,
          rangeStart: fetchStart.toISOString(),
          rangeEnd: fetchEnd.toISOString(),
          tz: timezone,
        }),
      });
      const { summary } = summaryRes.ok
        ? (await summaryRes.json() as { summary: string })
        : { summary: lang === 'en-US' ? 'Could not generate summary.' : '摘要生成失败。' };

      setResult({ kind: 'summarize', summary, events, rangeLabel });
      if (ttsEnabled) speak(summary);
    } catch {
      setActionError(lang === 'en-US' ? 'Summary failed, please retry' : '摘要生成失败，请重试');
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 4: Handle `summarize` intent inside `handleCommand` (after the `query` block, around line 161)**

After the `if (parsed.intent === 'query') { ... return; }` block, add:

```ts
      if (parsed.intent === 'summarize') {
        const fetchStart = parsed.queryRangeStart
          ? new Date(parsed.queryRangeStart)
          : dayRange(new Date())[0];
        const fetchEnd = parsed.queryRangeEnd
          ? new Date(parsed.queryRangeEnd)
          : dayRange(new Date())[1];

        setSummaryListOpen(false);
        const events = await fetchRange([fetchStart, fetchEnd]);
        const summaryRes = await fetch('/api/llm/schedule-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events,
            lang,
            rangeStart: fetchStart.toISOString(),
            rangeEnd: fetchEnd.toISOString(),
            tz: timezone,
          }),
        });
        const { summary } = summaryRes.ok
          ? (await summaryRes.json() as { summary: string })
          : { summary: lang === 'en-US' ? 'Could not generate summary.' : '摘要生成失败。' };

        setResult({ kind: 'summarize', summary, events, rangeLabel: '' });
        if (ttsEnabled) speak(summary);
        return;
      }
```

- [ ] **Step 5: Add summarize result JSX (in the result area, after the `query` block around line 340)**

After the closing `</>` of `result.kind === 'query'` block, add:

```tsx
            {result.kind === 'summarize' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-blue-400 font-medium">
                    {result.rangeLabel
                      ? (lang === 'en-US' ? `AI Summary · ${result.rangeLabel}` : `AI 摘要 · ${result.rangeLabel}`)
                      : (lang === 'en-US' ? 'AI Summary' : 'AI 摘要')}
                  </p>
                  <button
                    onClick={() => setTtsEnabled(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      ttsEnabled
                        ? 'border-blue-300 text-blue-500 bg-blue-50'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-100'
                    }`}
                    title={ttsEnabled
                      ? (lang === 'en-US' ? 'Mute TTS' : '关闭朗读')
                      : (lang === 'en-US' ? 'Enable TTS' : '开启朗读')}
                  >
                    {ttsEnabled ? '🔊' : '🔇'}
                  </button>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-sm text-blue-800 leading-relaxed">{result.summary}</p>
                </div>
                {result.events.length > 0 && (
                  <div>
                    <button
                      onClick={() => setSummaryListOpen(v => !v)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1 mt-2"
                    >
                      <span>{summaryListOpen ? '▾' : '▸'}</span>
                      {summaryListOpen
                        ? (lang === 'en-US' ? 'Collapse' : '收起')
                        : (lang === 'en-US'
                            ? `Show ${result.events.length} event${result.events.length > 1 ? 's' : ''}`
                            : `展开 ${result.events.length} 个安排`)}
                    </button>
                    {summaryListOpen && (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {result.events.map((e) => (
                          <div key={e.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                            {eventRow(e)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
```

- [ ] **Step 6: Add quick buttons to both idle states**

In the voice mode idle area (the `!textMode` branch), find the `<button onClick={() => { stop(); setTextMode(true); }}>` button. Add the quick buttons **before** it:

```tsx
            <div className="flex gap-2">
              <button
                onClick={() => { stop(); void handleSummary('today'); }}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 Today' : '📋 今天'}
              </button>
              <button
                onClick={() => { stop(); void handleSummary('week'); }}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 This Week' : '📋 本周'}
              </button>
            </div>
```

In the text mode area (the `textMode` branch), find the `<div className="flex items-center justify-between">` at the bottom. Add the quick buttons **after** the closing `</div>` of that flex row, still inside the outer `flex flex-col gap-3` div:

```tsx
            <div className="flex gap-2">
              <button
                onClick={() => void handleSummary('today')}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 Today' : '📋 今天'}
              </button>
              <button
                onClick={() => void handleSummary('week')}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 This Week' : '📋 本周'}
              </button>
            </div>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 8: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```
Expected: all existing tests pass.

- [ ] **Step 9: Commit**

```bash
git add components/voice/VoiceCommandOverlay.tsx
git commit -m "feat: 语音浮层新增 summarize 意图、快捷按钮和 TTS 开关"
```

---

## Manual Verification Checklist

Start the dev server (`pnpm dev -p 3001`) and verify in the browser:

1. **Quick buttons — voice mode**: Open voice overlay → see "📋 今天" and "📋 本周" buttons → click "📋 本周" → spinner shows → blue summary card appears with 2-4 sentence narrative → TTS reads aloud
2. **Quick buttons — text mode**: Switch to text mode → same buttons appear at bottom → click → same result
3. **TTS toggle**: After summary appears, click 🔊 → becomes 🔇 → click "📋 今天" again → no TTS plays → click 🔇 → becomes 🔊
4. **Collapsible list**: If events exist, "展开 N 个安排" button appears → click → events list shows → click "收起" → list hides
5. **Voice trigger**: Say "帮我总结一下这周的行程" → same result as clicking "📋 本周"
6. **Text trigger**: Type "总结今天的安排" → submit → AI summary appears
7. **Empty range**: Click "📋 今天" when no events today → summary says so warmly (e.g. "今天没有安排，好好休息吧！")
8. **English mode**: Toggle to EN → click "📋 This Week" → summary is in English, TTS in English
