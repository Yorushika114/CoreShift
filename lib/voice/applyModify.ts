import type { CalendarEvent, ParsedCommand } from '@/types';

/**
 * 把语音 modify 指令解析出的值，按"只覆盖明确提到的字段"原则合并到原事件上。
 * 例："把会议推迟到4点" 只改时间、保留原日期；"改到后天" 只改日期、保留原时间。
 * 改动开始时间时，若原事件有结束时间则保持原时长平移。
 *
 * 返回一个克隆事件（含原 id），供编辑面板以"编辑模式"预填，由用户手动确认保存。
 */
export function applyModify(event: CalendarEvent, parsed: ParsedCommand): CalendarEvent {
  const start = new Date(event.startAt);
  const originalDurationMs = event.endAt
    ? new Date(event.endAt).getTime() - start.getTime()
    : null;

  if (parsed.startAt) {
    const p = new Date(parsed.startAt);
    if (parsed.hasDate) start.setFullYear(p.getFullYear(), p.getMonth(), p.getDate());
    if (parsed.hasTime) start.setHours(p.getHours(), p.getMinutes(), 0, 0);
  }

  // 结束时间：语音里显式说了"到X点"用解析值；否则按原时长平移
  let endAt: string | null = event.endAt ?? null;
  if (parsed.endAt) {
    endAt = parsed.endAt;
  } else if (originalDurationMs !== null) {
    endAt = new Date(start.getTime() + originalDurationMs).toISOString();
  }

  return { ...event, startAt: start.toISOString(), endAt };
}
