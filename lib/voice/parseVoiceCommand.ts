import { parseChineseTime, extractReminderOffset } from './parseChineseTime';
import type { ParsedCommand } from '@/types';

/** 从文本提取重复频率 */
function extractRecurrence(text: string, lang: 'zh-CN' | 'en-US'): 'daily' | 'weekly' | 'monthly' | null {
  if (lang === 'en-US') {
    if (/every\s+day|daily/i.test(text)) return 'daily';
    if (/every\s+week|weekly/i.test(text)) return 'weekly';
    if (/every\s+month|monthly/i.test(text)) return 'monthly';
    return null;
  }
  if (/每天|每日/.test(text)) return 'daily';
  if (/每周|每星期/.test(text)) return 'weekly';
  if (/每月|每个月/.test(text)) return 'monthly';
  return null;
}

/** 从文本提取重复截止条件 */
function extractRecurrenceEnd(
  text: string,
  fallback: Date,
): { recurrenceEndAt: string | null; recurrenceCount: number | null } {
  // 次数：共N次 / 做N次
  const countMatch = text.match(/(?:共|做)(\d+)次/);
  if (countMatch) {
    return { recurrenceEndAt: null, recurrenceCount: parseInt(countMatch[1]) };
  }

  // 时长换算：持续N个月 / 做N个月（次数匹配优先，避免和"做N次"冲突）
  const durationMatch = text.match(/(?:持续|做)(\d+)个?月/);
  if (durationMatch) {
    const months = parseInt(durationMatch[1]);
    const endDate = new Date(fallback);
    endDate.setDate(1);
    endDate.setMonth(endDate.getMonth() + months);
    const lastDay = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
    endDate.setDate(Math.min(fallback.getDate(), lastDay));
    return { recurrenceEndAt: endDate.toISOString(), recurrenceCount: null };
  }

  // 截止到月底：开到X月底 / 到X月底
  const monthEndMatch = text.match(/(?:开到|到)(\d{1,2})月底/);
  if (monthEndMatch) {
    const month = parseInt(monthEndMatch[1]) - 1; // 0-indexed
    const year = month < fallback.getMonth() ? fallback.getFullYear() + 1 : fallback.getFullYear();
    // 当月最后一天：下月第0天
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    return { recurrenceEndAt: endDate.toISOString(), recurrenceCount: null };
  }

  // 截止到具体日期：开到X月X号/日 / 到X月X号/日
  const dateMatch = text.match(/(?:开到|到)(\d{1,2})月(\d{1,2})[号日]/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1;
    const day = parseInt(dateMatch[2]);
    const year = (month < fallback.getMonth() || (month === fallback.getMonth() && day < fallback.getDate()))
      ? fallback.getFullYear() + 1
      : fallback.getFullYear();
    const endDate = new Date(year, month, day, 23, 59, 59);
    return { recurrenceEndAt: endDate.toISOString(), recurrenceCount: null };
  }

  return { recurrenceEndAt: null, recurrenceCount: null };
}

// 时间相关词汇，用于从原文中剥离出标题
const TIME_PATTERNS = [
  // "X点到Y点" 或 "X点，到，Y点" 或 "X点到明天早上Y点"：允许标点/空格，也允许日期词
  /(?<=[点時时钟][，,、。\s]{0,3})到[，,、。\s]*(今天|今日|明天|明日|后天|大后天)?[，,、。\s]*(凌晨|早上|上午|中午|下午|傍晚|晚上|晚)?(\d{1,2}|[一二三四五六七八九十两]+)[点時时][钟]?[半]?(\d{1,2}分?|[一二三四五六七八九十零]+分?)?/,
  /(\d{1,2}|[一二三四五六七八九十两]+)[点時时][钟]?[半]?(\d{1,2}分?|[一二三四五六七八九十零]+分?)?/,
  /(下下周|下周|下个周|这周|本周|这个周)(日|天|一|二|三|四|五|六)/,
  /(下下个?月|下个?月|这个?月|本月)(\d{1,2}|[一二三四五六七八九十]+)[日号]/,
  /(\d{1,2}|[一二三四五六七八九十]+)月(\d{1,2}|[一二三四五六七八九十]+)[日号]/,
  /(\d+|[一二三四五六七八九十]+)天[后後]/,
  // 相对时间偏移：半小时后 / N(个)小时后 / N分钟后
  /半个?(?:小时|钟头)[后後]/,
  /(\d+|[一二三四五六七八九十两]+)个?(?:小时|钟头)[后後]/,
  /(\d+|[一二三四五六七八九十两]+)分钟?[后後]/,
  /大后天|今天|今日|明天|明日|后天/,
  /凌晨|早上|上午|中午|下午|傍晚|晚上|夜晚?|晚/,
  // 截止类语义词
  /之前|以前|截止|之内|以内|前完成/,
  // 提醒短语
  /提前(\d+|[一二三四五六七八九十百]+)(分钟|小时)/,
  /(\d+|[一二三四五六七八九十]+)分钟前/,
  /提前半小时/,
];

// English time strip patterns (order matters: longer patterns first)
const EN_TIME_PATTERNS: RegExp[] = [
  /\bnext\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  /\bthis\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  /\btomorrow\b/gi,
  /\btonight\b/gi,
  /\btoday\b/gi,
  /\b\d{1,2}:\d{2}\s*(?:am|pm)\b/gi,
  /\b\d{1,2}\s*(?:am|pm)\b/gi,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:am|pm)\b/gi,
  /\b\d{2}:\d{2}\b/gi,
  /\bin\s+\d+\s+(?:minutes?|hours?|days?)\b/gi,
];

const WORD_TO_HOUR: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// 指令/管理动词：从标题中剥离，避免污染事件名与 delete/modify 的匹配关键词。
// 只含"删除/查看/修改/安排"这类管理动作，不含"开会/会议/约/记"等事件本身的词。
const INTENT_VERB_PATTERN =
  /删除|删掉|删了|取消|移除|去掉|清除|撤销|查看|查询|查一下|看看|有什么|有哪些|修改|改到|改成|改为|改期|延期|推迟|更新|添加|新建|创建|安排|预约|记录|把/g;

function stripTimePhrases(text: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  let result = text;
  if (lang === 'en-US') {
    for (const p of EN_TIME_PATTERNS) {
      result = result.replace(p, ' ');
    }
    // Strip trailing/leading filler words that remain after time extraction
    result = result.replace(/\b(?:at|on|and|or|from|to|about|remind(?:er)?|me|please|a|an|the)\b/gi, ' ');
    return result.replace(/\s+/g, ' ').trim();
  }
  for (const p of TIME_PATTERNS) {
    result = result.replace(new RegExp(p.source, 'g'), '');
  }
  // 剥离指令动词（"删除明天的组会" → "组会"，"安排明天开会" → "开会"）
  result = result.replace(INTENT_VERB_PATTERN, '');
  // 清理助词和标点
  return result.replace(/[，。,.\s的在帮我给提醒请]+/g, ' ').trim();
}

function detectIntent(text: string): ParsedCommand['intent'] {
  if (/删除|删掉|删了|取消|移除|去掉|清除|撤销|\bremove\b|\bdelete\b|\bcancel\b/.test(text)) return 'delete';
  // 时间预算查询：询问某类活动本周花了多久 / 完成进度
  if (/(了|花了|用了)?多久|(了|花了|用了)?多少(时间|小时|分钟)|时间.{0,8}进度|完成了多少|还差多少|达标|时间够|(how (long|much time|many hours)|time budget|progress)/.test(text)) return 'budget_query';
  // 时间预算创建：添加/新建 + 目标，或含"每周X小时"的目标语句
  if (/(添加|新建|创建|设置|增加|加个?|加一个).{0,10}目标|目标.{0,15}(每周|小时|hours?\/?(week|wk))|(add|create|set)\s+\w+\s+(goal|target)/.test(text)) return 'budget_create';
  // 查询：用明确的查询词，不含裸"安排"（"安排"在创建指令里太常见，如"安排明天开会"）
  if (/查看|查询|有什么|有哪些|日程|看看|\bwhat.{0,15}(have|got|scheduled)\b|\bshow\b|\blist\b|\bany events?\b/.test(text)) return 'query';
  // 「提前X分钟/小时提醒」是创建意图（设提醒），不要被下面的"提前"误判为 modify
  const isReminderPhrase = /提前(\d+|[一二三四五六七八九十百]+)(分钟|小时)|提前半小时/.test(text);
  // 修改：用"改到/改成/改为/改期"等动补结构，不含裸"改"（避免"改稿"这类标题误判）
  if (!isReminderPhrase && /修改|改到|改成|改为|改期|推迟|提前|延期|\breschedule\b|\bmove\b|\bchange\b|\bupdate\b|\bedit\b/.test(text)) return 'modify';
  if (/总结|摘要|回顾|汇总|\bsummarize\b|\bsummary\b/i.test(text)) return 'summarize';
  if (/添加|新建|创建|加|安排|提醒|开会|会议|约|记|\badd\b|\bschedule\b|\bset\b|\bcreate\b|\bbook\b|\bmeeting\b|\bremind\b/.test(text)) return 'create';
  return 'create';
}

function parseEnglishTime(
  text: string,
  fallback: Date,
): { date: Date; hasDate: boolean; hasTime: boolean } {
  const lower = text.toLowerCase();
  let date = new Date(fallback);
  let hasDate = false;
  let hasTime = false;

  // Date resolution
  const nextDayMatch = lower.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  const thisDayMatch = !nextDayMatch && lower.match(/\bthis\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  const bareDayMatch = !nextDayMatch && !thisDayMatch && lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);

  if (/\btomorrow\b/.test(lower)) {
    date = new Date(fallback);
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    hasDate = true;
  } else if (/\btoday\b|\btonight\b/.test(lower)) {
    date = new Date(fallback);
    hasDate = true;
  } else if (nextDayMatch) {
    const targetDay = WEEKDAY_MAP[nextDayMatch[1]];
    date = new Date(fallback);
    const curDay = date.getDay();
    let diff = targetDay - curDay;
    if (diff <= 0) diff += 7;
    date.setDate(date.getDate() + diff);
    date.setHours(9, 0, 0, 0);
    hasDate = true;
  } else if (thisDayMatch) {
    const targetDay = WEEKDAY_MAP[thisDayMatch[1]];
    date = new Date(fallback);
    const curDay = date.getDay();
    let diff = targetDay - curDay;
    if (diff < 0) diff += 7;
    date.setDate(date.getDate() + diff);
    date.setHours(9, 0, 0, 0);
    hasDate = true;
  } else if (bareDayMatch) {
    const targetDay = WEEKDAY_MAP[bareDayMatch[1]];
    date = new Date(fallback);
    const curDay = date.getDay();
    let diff = targetDay - curDay;
    if (diff <= 0) diff += 7;
    date.setDate(date.getDate() + diff);
    date.setHours(9, 0, 0, 0);
    hasDate = true;
  }

  // Time resolution: "3:30 PM" / "3 PM" / "three PM" / "15:30"
  const colonAmPm = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/);
  const digitAmPm = !colonAmPm && lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  const wordAmPm = !colonAmPm && !digitAmPm &&
    lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm)\b/);
  const military = !colonAmPm && !digitAmPm && !wordAmPm && lower.match(/\b(\d{2}):(\d{2})\b/);

  if (colonAmPm) {
    let h = parseInt(colonAmPm[1]);
    const m = parseInt(colonAmPm[2]);
    if (colonAmPm[3] === 'pm' && h !== 12) h += 12;
    if (colonAmPm[3] === 'am' && h === 12) h = 0;
    date.setHours(h, m, 0, 0);
    hasTime = true;
  } else if (digitAmPm) {
    let h = parseInt(digitAmPm[1]);
    if (digitAmPm[2] === 'pm' && h !== 12) h += 12;
    if (digitAmPm[2] === 'am' && h === 12) h = 0;
    date.setHours(h, 0, 0, 0);
    hasTime = true;
  } else if (wordAmPm) {
    let h = WORD_TO_HOUR[wordAmPm[1]] ?? 12;
    if (wordAmPm[2] === 'pm' && h !== 12) h += 12;
    if (wordAmPm[2] === 'am' && h === 12) h = 0;
    date.setHours(h, 0, 0, 0);
    hasTime = true;
  } else if (military) {
    date.setHours(parseInt(military[1]), parseInt(military[2]), 0, 0);
    hasTime = true;
  }

  return { date, hasDate, hasTime };
}

// 提取结束时间：取文本中最后一个 "到X点" 的时间（极端情况多个"到"取最后一个）
function extractEndTime(text: string, startDate: Date): string | undefined {
  // 回顾断言：要求"到"前面是时间字符，避免把"推迟到/改到"误判为结束时间
  const endPattern = /(?<=[点時时钟][，,、。\s]{0,3})到[，,、。\s]*(今天|今日|明天|明日|后天|大后天)?[，,、。\s]*(凌晨|早上|上午|中午|下午|傍晚|晚上|晚)?(\d{1,2}|[一二三四五六七八九十两]+)[点時时]([半]|\d{1,2}分?|[一二三四五六七八九十零]+分?)?/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = endPattern.exec(text)) !== null) lastMatch = m;
  if (!lastMatch) return undefined;
  const datePart = lastMatch[1] ?? '';
  const period = lastMatch[2] ?? '';
  const minPart = lastMatch[4] ?? '';
  const fullEndText = `${datePart}${period}${lastMatch[3]}点${minPart}`;
  const { date } = parseChineseTime(fullEndText, startDate);
  if (date <= startDate) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function parseVoiceCommand(
  text: string,
  fallbackDate: Date = new Date(),
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
): ParsedCommand {
  const intent = detectIntent(text);

  let date: Date;
  let hasDate: boolean;
  let hasTime: boolean;

  if (lang === 'en-US') {
    ({ date, hasDate, hasTime } = parseEnglishTime(text, fallbackDate));
  } else {
    ({ date, hasDate, hasTime } = parseChineseTime(text, fallbackDate));
  }

  let resolvedDate = date;

  if (!hasDate && !hasTime) {
    // 没有日期也没有时间 → 直接使用 fallbackDate（保留点击时间格的完整时刻）
    resolvedDate = new Date(fallbackDate);
  } else if (!hasDate && hasTime && resolvedDate < fallbackDate) {
    // BUG-04: only time given (no date) and that time has already passed → default to same time tomorrow
    resolvedDate = new Date(resolvedDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const startAt = resolvedDate.toISOString();
  // extractEndTime uses Chinese patterns — skip for English input
  const endAt = lang !== 'en-US' ? extractEndTime(text, resolvedDate) : undefined;
  const title = stripTimePhrases(text, lang) || undefined;

  // extractReminderOffset uses Chinese patterns — skip for English input
  const reminderOffsetMin = lang !== 'en-US' ? extractReminderOffset(text) : null;
  const reminderAt = reminderOffsetMin !== null
    ? new Date(resolvedDate.getTime() - reminderOffsetMin * 60 * 1000).toISOString()
    : undefined;

  const recurrence = extractRecurrence(text, lang);
  const { recurrenceEndAt, recurrenceCount } = recurrence
    ? extractRecurrenceEnd(text, resolvedDate)
    : { recurrenceEndAt: null, recurrenceCount: null };

  const isEn = lang === 'en-US';
  const ambiguities: string[] = [];
  if (!hasDate) {
    if (hasTime && resolvedDate.getTime() !== date.getTime()) {
      ambiguities.push(isEn
        ? 'Time has already passed today — automatically moved to tomorrow'
        : '该时间今天已过，已自动设为明天同一时刻');
    } else {
      ambiguities.push(isEn
        ? 'No date recognized, using currently selected date'
        : '未识别到日期，已使用当前选中日期');
    }
  }
  if (!hasTime) ambiguities.push(isEn ? 'No time recognized, using currently selected time' : '未识别到具体时间，已使用当前选中时间');
  if (!title) ambiguities.push(isEn ? 'No event title recognized' : '未识别到事件标题');

  return {
    intent,
    title: title || undefined,
    startAt,
    endAt,
    hasDate,
    hasTime,
    reminderAt,
    ambiguities,
    clarificationNeeded: !title,
    clarificationQuestion: !title
      ? (isEn ? 'What is the title of this event?' : '请问这个事件的标题是什么？')
      : undefined,
    recurrence,
    recurrenceEndAt: recurrenceEndAt ?? null,
    recurrenceCount: recurrenceCount ?? null,
  };
}

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 两: 2 };

function cnToNum(s: string): number {
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  let n = 0;
  for (const c of s) n += CN_NUM[c] ?? 0;
  return n || 0;
}

export type ParsedBudgetCreate = {
  label: string;
  keywords: string;
  targetMinutes: number;
};

export function parseBudgetCreate(text: string): ParsedBudgetCreate {
  // Label: between action verb and 目标
  const labelMatch = text.match(/(?:添加|新建|创建|设置|增加|加个?|加一个)\s*([^\s，。,的每周小时目标]{1,10}?)\s*目标/) ??
                     text.match(/([^\s，。,的每周小时]{1,8}?)\s*目标\s*[，,]?\s*(?:每周|小时)/);
  const label = labelMatch?.[1]?.trim() ?? '';

  // Target hours: arabic or chinese
  let targetMinutes = 5 * 60;
  const arMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:个?小时|h(?:ours?)?)/);
  if (arMatch) {
    targetMinutes = Math.round(parseFloat(arMatch[1]) * 60);
  } else {
    const cnMatch = text.match(/([一二三四五六七八九十两]+(?:点[五]?)?)\s*(?:个?小时)/);
    if (cnMatch) {
      const h = cnToNum(cnMatch[1]);
      if (h > 0) targetMinutes = h * 60;
    }
  }

  // Keywords: after 关键词 / keyword
  let keywords = '';
  const kwMatch = text.match(/(?:关键词|keywords?)[是为：: ]*([^，。,.小时目标]{1,30})/i);
  if (kwMatch) {
    keywords = kwMatch[1].replace(/[，、\s]+/g, ',').replace(/,+/g, ',').trim();
  }

  return { label, keywords, targetMinutes };
}

type LLMParsedCommand = ParsedCommand & {
  queryRangeStart?: string;
  queryRangeEnd?: string;
};

/**
 * LLM 优先的语音指令解析。调用 /api/llm/parse，失败时静默降级到正则解析。
 */
export async function parseVoiceCommandWithLLM(
  text: string,
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
  fallbackDate: Date = new Date(),
  tz?: string
): Promise<LLMParsedCommand> {
  try {
    const resolvedTz = tz
      ?? (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Shanghai');
    const res = await fetch('/api/llm/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang,
        now: fallbackDate.toISOString(),
        tz: resolvedTz,
      }),
    });
    if (!res.ok) throw new Error(`LLM parse failed: ${res.status}`);
    const parsed = await res.json() as LLMParsedCommand;
    if (!Array.isArray(parsed.ambiguities)) parsed.ambiguities = [];
    return parsed;
  } catch {
    const fallback = parseVoiceCommand(text, fallbackDate, lang);
    if (fallback.intent === 'summarize') {
      const now = fallbackDate;
      let queryRangeStart: string;
      let queryRangeEnd: string;
      if (/今天|今日|\btoday\b/i.test(text)) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        queryRangeStart = start.toISOString();
        queryRangeEnd = end.toISOString();
      } else {
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        queryRangeStart = weekStart.toISOString();
        queryRangeEnd = weekEnd.toISOString();
      }
      return { ...fallback, queryRangeStart, queryRangeEnd };
    }
    return fallback;
  }
}
