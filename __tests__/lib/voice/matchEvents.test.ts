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

// 2026-05-30 三条，2026-05-31 一条（月份 0-based：4 = 5月）
const EVENTS: CalendarEvent[] = [
  ev('1', '组会', 4, 30, 15),
  ev('2', '算法课', 4, 30, 9),
  ev('3', '组会复盘', 4, 30, 18),
  ev('4', '组会', 4, 31, 15),
];

const MAY30 = new Date(2026, 4, 30);

describe('matchEvents 日期过滤', () => {
  it('hasDate 时只保留当天事件', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true });
    expect(r.map((e) => e.id).sort()).toEqual(['1', '2', '3']);
  });

  it('hasDate 为 false 时不按日期过滤', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: false, title: '组会' });
    // 跨两天的"组会"都应命中（含模糊"组会复盘"）
    expect(r.map((e) => e.id).sort()).toEqual(['1', '3', '4']);
  });
});

describe('matchEvents 标题模糊', () => {
  it('单条命中：日期 + 唯一标题', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '算法课' });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('2');
  });

  it('多条命中：标题子串匹配多个', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '组会' });
    // "组会" 命中 "组会" 与 "组会复盘"
    expect(r.map((e) => e.id).sort()).toEqual(['1', '3']);
  });

  it('双向匹配："开组会" 命中标题 "组会"（标题是关键词的子串）', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '开组会' });
    // "组会" 是 "开组会" 的子串 → 命中 id 1；"组会复盘" 与 "开组会" 互不包含 → 不命中
    expect(r.map((e) => e.id).sort()).toEqual(['1']);
  });

  it('零条命中：标题无匹配', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '健身' });
    expect(r).toHaveLength(0);
  });
});

describe('matchEvents 边界', () => {
  it('无标题关键词时返回当天全部（供用户挑选）', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true });
    expect(r).toHaveLength(3);
  });

  it('空标题字符串视为无关键词', () => {
    const r = matchEvents(EVENTS, { date: MAY30, hasDate: true, title: '   ' });
    expect(r).toHaveLength(3);
  });
});
