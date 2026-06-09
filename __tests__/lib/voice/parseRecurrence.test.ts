import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';

// 固定 fallback 日期：2026-06-09 周二 09:00
const BASE = new Date(2026, 5, 9, 9, 0);

describe('重复频率识别', () => {
  it('每天 → daily', () => {
    const r = parseVoiceCommand('每天早上8点晨会', BASE);
    expect(r.recurrence).toBe('daily');
  });

  it('每日 → daily', () => {
    const r = parseVoiceCommand('每日下午两点站会', BASE);
    expect(r.recurrence).toBe('daily');
  });

  it('每周 → weekly', () => {
    const r = parseVoiceCommand('每周一下午3点组会', BASE);
    expect(r.recurrence).toBe('weekly');
  });

  it('每星期 → weekly', () => {
    const r = parseVoiceCommand('每星期二下午开例会', BASE);
    expect(r.recurrence).toBe('weekly');
  });

  it('每月 → monthly', () => {
    const r = parseVoiceCommand('每月15号下午财务汇报', BASE);
    expect(r.recurrence).toBe('monthly');
  });

  it('每个月 → monthly', () => {
    const r = parseVoiceCommand('每个月底结算会议', BASE);
    expect(r.recurrence).toBe('monthly');
  });

  it('无重复词 → recurrence 为 null/undefined', () => {
    const r = parseVoiceCommand('明天上午开会', BASE);
    expect(r.recurrence == null).toBe(true);
  });
});

describe('重复结束条件 - 截止日期', () => {
  it('开到6月底 → recurrenceEndAt 为6月30日', () => {
    const r = parseVoiceCommand('每周开会开到6月底', BASE);
    expect(r.recurrenceEndAt).toBeDefined();
    const d = new Date(r.recurrenceEndAt!);
    expect(d.getMonth()).toBe(5); // 6月
    expect(d.getDate()).toBe(30);
  });

  it('到7月15号 → recurrenceEndAt 为7月15日', () => {
    const r = parseVoiceCommand('每天站会到7月15号', BASE);
    expect(r.recurrenceEndAt).toBeDefined();
    const d = new Date(r.recurrenceEndAt!);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
  });

  it('同月但日期已过 → 应推到明年 (到6月5号，当前6月9日)', () => {
    const r = parseVoiceCommand('每周开会到6月5号', BASE);
    expect(r.recurrenceEndAt).toBeDefined();
    const d = new Date(r.recurrenceEndAt!);
    // BASE = 2026-06-09，"到6月5号"应推到 2027-06-05
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(5); // 6月
    expect(d.getDate()).toBe(5);
  });
});

describe('重复结束条件 - 次数', () => {
  it('共10次 → recurrenceCount=10', () => {
    const r = parseVoiceCommand('每周开会共10次', BASE);
    expect(r.recurrenceCount).toBe(10);
  });

  it('做5次 → recurrenceCount=5', () => {
    const r = parseVoiceCommand('每天站会做5次', BASE);
    expect(r.recurrenceCount).toBe(5);
  });
});

describe('重复结束条件 - 时长换算', () => {
  it('持续3个月 → recurrenceEndAt 约为3个月后', () => {
    const r = parseVoiceCommand('每周开会持续3个月', BASE);
    expect(r.recurrenceEndAt).toBeDefined();
    const d = new Date(r.recurrenceEndAt!);
    // BASE = 2026-06-09，+3月 = 2026-09-09
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // 9月
  });

  it('做3个月 → recurrenceEndAt 约为3个月后', () => {
    const r = parseVoiceCommand('每天晨会做3个月', BASE);
    expect(r.recurrenceEndAt).toBeDefined();
    const d = new Date(r.recurrenceEndAt!);
    expect(d.getMonth()).toBe(8);
  });
});

describe('英文输入', () => {
  it('every day → daily', () => {
    const r = parseVoiceCommand('standup every day at 9am', BASE, 'en-US');
    expect(r.recurrence).toBe('daily');
  });

  it('every week → weekly', () => {
    const r = parseVoiceCommand('team meeting every week', BASE, 'en-US');
    expect(r.recurrence).toBe('weekly');
  });

  it('every month → monthly', () => {
    const r = parseVoiceCommand('financial review every month', BASE, 'en-US');
    expect(r.recurrence).toBe('monthly');
  });
});
