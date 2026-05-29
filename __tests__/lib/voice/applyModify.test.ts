import { applyModify } from '@/lib/voice/applyModify';
import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';
import type { CalendarEvent } from '@/types';

const BASE = new Date(2026, 4, 29); // 2026-05-29 周五

// 原事件：5-30 14:00 ~ 15:00（本地时间构造，避免时区漂移）
function baseEvent(): CalendarEvent {
  const start = new Date(2026, 4, 30, 14, 0);
  const end = new Date(2026, 4, 30, 15, 0);
  return {
    id: 'e1',
    title: '组会',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    reminderAt: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    sourceText: null,
  };
}

describe('applyModify 字段级 patch', () => {
  it('只说时间：改时间、保留原日期，结束时间按原时长平移', () => {
    const parsed = parseVoiceCommand('把组会推迟到下午4点', BASE);
    const patched = applyModify(baseEvent(), parsed);
    const s = new Date(patched.startAt);
    expect(s.getMonth()).toBe(4);
    expect(s.getDate()).toBe(30);   // 日期保留
    expect(s.getHours()).toBe(16);  // 时间改为 16:00
    const e = new Date(patched.endAt!);
    expect(e.getHours()).toBe(17);  // 原 1 小时时长平移 → 17:00
  });

  it('只说日期：改日期、保留原时间', () => {
    const parsed = parseVoiceCommand('把组会改到后天', BASE);
    const patched = applyModify(baseEvent(), parsed);
    const s = new Date(patched.startAt);
    expect(s.getDate()).toBe(31);   // 后天 = 5-31
    expect(s.getHours()).toBe(14);  // 时间保留 14:00
  });

  it('保留事件 id 与标题', () => {
    const parsed = parseVoiceCommand('把组会推迟到下午4点', BASE);
    const patched = applyModify(baseEvent(), parsed);
    expect(patched.id).toBe('e1');
    expect(patched.title).toBe('组会');
  });
});
