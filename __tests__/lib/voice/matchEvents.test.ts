import { matchEvents } from '@/lib/voice/matchEvents';
import type { CalendarEvent } from '@/types';

// 用本地时间构造，避免 UTC 解析在不同时区跨日导致测试漂移
function ev(id: string, title: string, month: number, day: number, hour: number): CalendarEvent {
  const iso = new Date(2026, month, day, hour).toISOString();
  return {
    id,
    title,
    startAt: iso,
    endAt: null,
    reminderAt: null,
    createdAt: iso,
    updatedAt: iso,
    sourceText: null,
  };
}

const EVENTS: CalendarEvent[] = [
  ev('1', '组会', 4, 30, 15),     // 5-30
  ev('2', '算法课', 4, 30, 9),     // 5-30
  ev('3', '组会复盘', 4, 30, 18),  // 5-30
  ev('4', '周会', 5, 2, 15),       // 6-02
  ev('6', '组会', 5, 5, 15),       // 6-05（较远）
];

const MAY30 = new Date(2026, 4, 30);

describe('matchEvents 分层（exact / fuzzy / all / none）', () => {
  it('exact：说了日期 + 当天标题子串命中', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '组会' });
    expect(r.tier).toBe('exact');
    // 仅当天（5-30）的 组会 / 组会复盘；6-05 的组会不算 exact
    expect(r.results.map((e) => e.id).sort()).toEqual(['1', '3']);
  });

  it('exact 唯一命中', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '算法课' });
    expect(r.tier).toBe('exact');
    expect(r.results.map((e) => e.id)).toEqual(['2']);
  });

  it('fuzzy：当天无子串 → 全窗口字符重叠/子串（周会↔组会）', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '周会' });
    expect(r.tier).toBe('fuzzy');
    const ids = r.results.map((e) => e.id);
    expect(ids).toContain('4'); // 周会 精确子串
    expect(ids).toContain('1'); // 组会 字符重叠 Dice=0.5
  });

  it('没说日期：即使子串唯一命中也只算 fuzzy（不触发自动执行）', () => {
    const r = matchEvents(EVENTS, { hasDate: false, title: '算法课' });
    expect(r.tier).toBe('fuzzy');
    expect(r.results.map((e) => e.id)).toContain('2');
  });

  it('all：标题完全不沾 → 兜底列出候选（不再返回空）', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '钓鱼' });
    expect(r.tier).toBe('all');
    expect(r.results.length).toBeGreaterThan(0);
  });

  it('无标题 + 有日期：列当天候选', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true });
    expect(r.tier).toBe('all');
    expect(r.results.map((e) => e.id).sort()).toEqual(['1', '2', '3']);
  });

  it('none：窗口内零事件', () => {
    const r = matchEvents([], { date: MAY30, hasDate: true, title: '组会' });
    expect(r.tier).toBe('none');
    expect(r.results).toEqual([]);
  });
});

describe('matchEvents 排序与上限', () => {
  it('结果按与目标日期临近排序（当天优先于较远）', () => {
    // hasDate=false 不进 exact，date 仅作排序参照
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: false, title: '组会' });
    const ids = r.results.map((e) => e.id);
    // 5-30 的 id1 应排在 6-05 的 id6 前面
    expect(ids.indexOf('1')).toBeLessThan(ids.indexOf('6'));
  });

  it('兜底候选最多 8 条', () => {
    const many = Array.from({ length: 20 }, (_, i) => ev('m' + i, '随便' + i, 4, 30, i % 24));
    const r = matchEvents(many, { date: MAY30, hasDate: true, title: '钓鱼' });
    expect(r.results.length).toBeLessThanOrEqual(8);
  });
});

describe('matchEvents exact 仍保留单字 guard（避免误自动执行）', () => {
  it('exact 子串反向匹配要求标题≥2字', () => {
    const evs = [ev('a', '会', 4, 30, 10), ev('b', '组会复盘', 4, 30, 11)];
    const r = matchEvents(evs, { date: MAY30, hasDate: true, title: '组会' });
    // 单字"会"不应作为 exact 子串命中；"组会复盘" 命中
    expect(r.tier).toBe('exact');
    expect(r.results.map((e) => e.id)).toEqual(['b']);
  });
});
