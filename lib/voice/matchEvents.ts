import type { CalendarEvent } from '@/types';

/**
 * 把语音指令解析出的（日期 + 标题关键词）匹配到现有事件上，
 * 供 delete / modify 定位目标事件。返回匹配列表，由调用方按
 * 多条 / 单条 / 零条分别处理（列出选 / 确认 / 未找到）。
 */

export interface MatchCriteria {
  /** 解析出的目标日期 */
  date?: Date;
  /** 语音里是否明确提到了日期；为 true 才按当天过滤 */
  hasDate?: boolean;
  /** 标题关键词（已剥离时间词），用于模糊匹配 */
  title?: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function matchEvents(
  events: CalendarEvent[],
  criteria: MatchCriteria
): CalendarEvent[] {
  let result = events;

  // 1) 日期过滤：仅当用户明确说了日期时按当天筛
  if (criteria.hasDate && criteria.date) {
    const target = criteria.date;
    result = result.filter((e) => isSameDay(new Date(e.startAt), target));
  }

  // 2) 标题模糊：双向子串匹配（"会议" 命中 "组会议"，"开组会" 命中 "组会"）
  const kw = criteria.title?.trim();
  if (kw) {
    result = result.filter(
      (e) => e.title.includes(kw) || kw.includes(e.title)
    );
  }

  return result;
}
