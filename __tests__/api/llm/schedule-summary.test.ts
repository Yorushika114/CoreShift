// Tests for /api/llm/schedule-summary route
// We test the handler logic by mocking fetch (the DeepSeek upstream call).

// jsdom doesn't include the Fetch API — provide a minimal polyfill so tests can
// construct Request objects and the route can return Response objects.
if (typeof globalThis.Request === 'undefined') {
  class MinimalRequest {
    private _body: string;
    constructor(_url: string, init?: { method?: string; headers?: Record<string,string>; body?: string }) {
      this._body = init?.body ?? '';
    }
    async json() { return JSON.parse(this._body); }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Request = MinimalRequest;
}
if (typeof globalThis.Response === 'undefined') {
  class MinimalResponse {
    status: number;
    private _body: string;
    constructor(body: string, init?: { status?: number }) {
      this._body = body;
      this.status = init?.status ?? 200;
    }
    async json() { return JSON.parse(this._body); }
    static json(data: unknown) {
      return new MinimalResponse(JSON.stringify(data), { status: 200 });
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Response = MinimalResponse;
}

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
