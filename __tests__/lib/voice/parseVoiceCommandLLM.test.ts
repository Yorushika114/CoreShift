import { parseVoiceCommandWithLLM } from '@/lib/voice/parseVoiceCommand';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

describe('parseVoiceCommandWithLLM', () => {
  it('returns LLM result when API succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        intent: 'create',
        title: '组会',
        startAt: '2026-05-31T07:00:00.000Z',
        hasDate: true,
        hasTime: true,
        ambiguities: [],
        clarificationNeeded: false,
      }),
    });

    const result = await parseVoiceCommandWithLLM('明天下午三点开组会', 'zh-CN', new Date('2026-05-30T10:00:00Z'));

    expect(result.intent).toBe('create');
    expect(result.title).toBe('组会');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/llm/parse',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to regex when API returns 503', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await parseVoiceCommandWithLLM('明天下午三点开组会', 'zh-CN', new Date('2026-05-30T10:00:00Z'));

    expect(result.intent).toBe('create');
    expect(result.title).toBeDefined();
  });

  it('falls back to regex when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await parseVoiceCommandWithLLM('删除明天的会议', 'zh-CN', new Date('2026-05-30T10:00:00Z'));

    expect(result.intent).toBe('delete');
  });

  it('passes lang to the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        intent: 'create',
        title: 'team meeting',
        startAt: '2026-05-31T07:00:00.000Z',
        hasDate: true,
        hasTime: true,
        ambiguities: [],
        clarificationNeeded: false,
      }),
    });

    await parseVoiceCommandWithLLM('meeting tomorrow at 3pm', 'en-US', new Date('2026-05-30T10:00:00Z'));

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.lang).toBe('en-US');
  });
});
