import type { CalendarEvent } from '@/types';

/**
 * 把语音指令解析出的（日期 + 标题关键词）匹配到现有事件上，供 delete / modify 定位目标。
 *
 * 分层「渐进回退」，尽量不返回空：
 *  - exact：明确说了日期 + 当天 + 标题子串命中（唯一时调用方可直接执行）
 *  - fuzzy：上一层为空 → 全窗口按 子串 / 字符重叠率(Dice) 命中（日期仅用于排序）
 *  - all  ：标题完全不沾 → 兜底列出候选（当天优先，否则全窗口）
 *  - none ：窗口内一条事件都没有
 * 结果按与目标日期（无则当下）的临近度排序，fuzzy/all 限 MAX_CANDIDATES 条。
 */

export type MatchTier = 'exact' | 'fuzzy' | 'all' | 'none';

export interface MatchCriteria {
  /** 解析出的目标日期（用于 exact 当天过滤 & 候选排序） */
  date?: Date;
  /** 语音里是否明确提到了日期；为 true 才走 exact 当天命中 */
  hasDate?: boolean;
  /** 标题关键词（已剥离时间/指令词），用于匹配 */
  title?: string;
  /** 跳过 MAX_CANDIDATES 上限，返回所有匹配事件（用于"删除所有X事件"等全量操作） */
  noCap?: boolean;
}

export interface MatchResult {
  results: CalendarEvent[];
  tier: MatchTier;
}

const MAX_CANDIDATES = 8;
const DICE_THRESHOLD = 0.34;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 双向子串：标题含关键词，或关键词含标题（反向要求标题≥2字，避免"会/课"误命中） */
function substringMatch(kw: string, title: string): boolean {
  return title.includes(kw) || (title.length >= 2 && kw.includes(title));
}

/** 字符集合的 Dice 相似度：2|A∩B| / (|A|+|B|)，处理近义/近音/记不全 */
function diceSimilarity(a: string, b: string): number {
  const sa = new Set(a.split(''));
  const sb = new Set(b.split(''));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((c) => {
    if (sb.has(c)) inter++;
  });
  return (2 * inter) / (sa.size + sb.size);
}

/** 按与参照时刻的临近度升序排序（越近越靠前） */
function sortByProximity(events: CalendarEvent[], ref: number): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      Math.abs(new Date(a.startAt).getTime() - ref) -
      Math.abs(new Date(b.startAt).getTime() - ref)
  );
}

export function matchEvents(events: CalendarEvent[], criteria: MatchCriteria): MatchResult {
  if (events.length === 0) return { results: [], tier: 'none' };

  const ref = (criteria.date ?? new Date()).getTime();
  const sortAll = (list: CalendarEvent[]) => sortByProximity(list, ref);
  const cap = (list: CalendarEvent[]) =>
    criteria.noCap ? sortAll(list) : sortAll(list).slice(0, MAX_CANDIDATES);

  const kw = criteria.title?.trim();
  const sameDayPool =
    criteria.hasDate && criteria.date
      ? events.filter((e) => isSameDay(new Date(e.startAt), criteria.date as Date))
      : events;

  if (kw) {
    // exact：仅当明确说了日期，且当天有标题子串命中
    if (criteria.hasDate && criteria.date) {
      const exact = sameDayPool.filter((e) => substringMatch(kw, e.title));
      if (exact.length > 0) return { results: sortAll(exact), tier: 'exact' };
    }
    // fuzzy：全窗口，子串 或 字符重叠率达阈值
    const fuzzy = events.filter(
      (e) => substringMatch(kw, e.title) || diceSimilarity(kw, e.title) >= DICE_THRESHOLD
    );
    if (fuzzy.length > 0) return { results: cap(fuzzy), tier: 'fuzzy' };
    // 标题完全不沾 → 兜底候选
    const pool = sameDayPool.length > 0 ? sameDayPool : events;
    return { results: cap(pool), tier: 'all' };
  }

  // 无标题：列候选（说了日期优先当天，当天为空则全窗口）
  const pool = sameDayPool.length > 0 ? sameDayPool : events;
  return { results: cap(pool), tier: 'all' };
}
