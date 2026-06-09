import { expandEvents } from '@/lib/calendar/recurrence';
import type { CalendarEvent } from '@/types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: '测试',
    startAt: new Date(2026, 0, 15, 9, 0).toISOString(), // 1月15日 9:00
    endAt: new Date(2026, 0, 15, 10, 0).toISOString(),
    reminderAt: null,
    allDay: false,
    recurrence: null,
    recurrenceEndAt: null,
    recurrenceCount: null,
    color: 'blue',
    createdAt: new Date(2026, 0, 1).toISOString(),
    updatedAt: new Date(2026, 0, 1).toISOString(),
    sourceText: null,
    ...overrides,
  };
}

const rangeStart = new Date(2026, 0, 1);
const rangeEnd = new Date(2026, 5, 30); // 到6月底

describe('monthly 展开', () => {
  it('每月15日展开 6 个实例', () => {
    const event = makeEvent({ recurrence: 'monthly' });
    const result = expandEvents([event], rangeStart, rangeEnd);
    expect(result.length).toBe(6); // 1/15, 2/15, 3/15, 4/15, 5/15, 6/15
  });

  it('每月31日在2月溢出时取2月28日', () => {
    const event = makeEvent({
      recurrence: 'monthly',
      startAt: new Date(2026, 0, 31, 9, 0).toISOString(),
      endAt: new Date(2026, 0, 31, 10, 0).toISOString(),
    });
    const rangeEnd2 = new Date(2026, 1, 28, 23, 59); // 到2月底
    const result = expandEvents([event], rangeStart, rangeEnd2);
    const febInstance = result.find(e => new Date(e.startAt).getMonth() === 1);
    expect(febInstance).toBeDefined();
    expect(new Date(febInstance!.startAt).getDate()).toBe(28);
  });

  it('recurrenceEndAt 截断 monthly 序列', () => {
    const event = makeEvent({
      recurrence: 'monthly',
      recurrenceEndAt: new Date(2026, 2, 31).toISOString(), // 3月底截止
    });
    const result = expandEvents([event], rangeStart, rangeEnd);
    expect(result.length).toBe(3); // 1/15, 2/15, 3/15
  });

  it('recurrenceCount=3 只展开3个实例', () => {
    const event = makeEvent({
      recurrence: 'monthly',
      recurrenceCount: 3,
    });
    const result = expandEvents([event], rangeStart, rangeEnd);
    expect(result.length).toBe(3);
  });
});

describe('weekly 展开', () => {
  it('recurrenceEndAt 截断 weekly', () => {
    const event = makeEvent({
      recurrence: 'weekly',
      startAt: new Date(2026, 0, 5, 9, 0).toISOString(), // 1月5日
      endAt: new Date(2026, 0, 5, 10, 0).toISOString(),
      recurrenceEndAt: new Date(2026, 0, 26).toISOString(), // 1月26日截止
    });
    const result = expandEvents([event], rangeStart, new Date(2026, 0, 31));
    expect(result.length).toBe(4); // 1/5, 1/12, 1/19, 1/26
  });
});

describe('exception 合并', () => {
  it('isDeleted=true 的 exception 从展开结果中排除该实例', () => {
    const jan15 = new Date(2026, 0, 15, 9, 0).toISOString();
    const event = makeEvent({ recurrence: 'monthly' });
    const exceptions = [
      { eventId: 'e1', date: jan15, isDeleted: true },
    ];
    const result = expandEvents([event], rangeStart, rangeEnd, exceptions);
    const hasJan15 = result.some(e => new Date(e.startAt).getMonth() === 0 && new Date(e.startAt).getDate() === 15);
    expect(hasJan15).toBe(false);
    expect(result.length).toBe(5); // 6 - 1
  });

  it('有覆盖字段的 exception 替换对应实例的 title', () => {
    const jan15 = new Date(2026, 0, 15, 9, 0).toISOString();
    const event = makeEvent({ recurrence: 'monthly' });
    const exceptions = [
      { eventId: 'e1', date: jan15, isDeleted: false, title: '临时替换会议' },
    ];
    const result = expandEvents([event], rangeStart, rangeEnd, exceptions);
    const jan15Instance = result.find(e => new Date(e.startAt).getMonth() === 0 && new Date(e.startAt).getDate() === 15);
    expect(jan15Instance?.title).toBe('临时替换会议');
  });
});

describe('addMonths 跨年溢出', () => {
  it('1月31日加13个月 → 次年2月28日', () => {
    const event = makeEvent({
      recurrence: 'monthly',
      startAt: new Date(2026, 0, 31, 9, 0).toISOString(),
      endAt: new Date(2026, 0, 31, 10, 0).toISOString(),
      recurrenceCount: 14,
    });
    const result = expandEvents([event], new Date(2027, 0, 1), new Date(2027, 2, 31));
    const febInstance = result.find(e => new Date(e.startAt).getMonth() === 1 && new Date(e.startAt).getFullYear() === 2027);
    expect(febInstance).toBeDefined();
    expect(new Date(febInstance!.startAt).getDate()).toBe(28);
  });
});

describe('recurrenceCount 语义（序列总次数）', () => {
  it('monthly: originalStart 在 rangeStart 之前，count 消耗后范围内只显示剩余次数', () => {
    // 事件从 2025-10-15 开始每月，recurrenceCount=5
    // 到 2026-01-01 之前已展开3次（10/15, 11/15, 12/15），剩余2次
    const event = makeEvent({
      recurrence: 'monthly',
      startAt: new Date(2025, 9, 15, 9, 0).toISOString(), // 2025-10-15
      endAt: new Date(2025, 9, 15, 10, 0).toISOString(),
      recurrenceCount: 5,
      recurrenceEndAt: null,
    });
    const result = expandEvents([event], new Date(2026, 0, 1), new Date(2026, 5, 30));
    // 剩余：2026-01-15, 2026-02-15（共2次，count 5 用完）
    expect(result.length).toBe(2);
  });

  it('daily: originalStart 在 rangeStart 之前，count 消耗后范围内只显示剩余次数', () => {
    // 事件从 2026-01-01 开始每天，recurrenceCount=5
    // rangeStart = 2026-01-04，已消耗3次（1/1, 1/2, 1/3），剩余2次
    const event = makeEvent({
      recurrence: 'daily',
      startAt: new Date(2026, 0, 1, 9, 0).toISOString(),
      endAt: new Date(2026, 0, 1, 10, 0).toISOString(),
      recurrenceCount: 5,
    });
    const result = expandEvents([event], new Date(2026, 0, 4), new Date(2026, 0, 31));
    // 剩余：2026-01-04, 2026-01-05（共2次，count 5 用完）
    expect(result.length).toBe(2);
  });

  it('weekly: originalStart 在 rangeStart 之前，count 消耗后范围内只显示剩余次数', () => {
    // 事件从 2026-01-05（周一）开始每周，recurrenceCount=4
    // rangeStart = 2026-01-19，已消耗2次（1/5, 1/12），剩余2次
    const event = makeEvent({
      recurrence: 'weekly',
      startAt: new Date(2026, 0, 5, 9, 0).toISOString(),
      endAt: new Date(2026, 0, 5, 10, 0).toISOString(),
      recurrenceCount: 4,
    });
    const result = expandEvents([event], new Date(2026, 0, 19), new Date(2026, 1, 28));
    // 剩余：2026-01-19, 2026-01-26（共2次，count 4 用完）
    expect(result.length).toBe(2);
  });
});
