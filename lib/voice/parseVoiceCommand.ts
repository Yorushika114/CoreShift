import { parseChineseTime, extractReminderOffset } from './parseChineseTime';
import type { ParsedCommand } from '@/types';

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

// 指令/管理动词：从标题中剥离，避免污染事件名与 delete/modify 的匹配关键词。
// 只含"删除/查看/修改/安排"这类管理动作，不含"开会/会议/约/记"等事件本身的词。
const INTENT_VERB_PATTERN =
  /删除|删掉|删了|取消|移除|去掉|清除|撤销|查看|查询|查一下|看看|有什么|有哪些|修改|改到|改成|改为|改期|延期|推迟|更新|添加|新建|创建|安排|预约|记录|把/g;

function stripTimePhrases(text: string): string {
  let result = text;
  for (const p of TIME_PATTERNS) {
    result = result.replace(new RegExp(p.source, 'g'), '');
  }
  // 剥离指令动词（"删除明天的组会" → "组会"，"安排明天开会" → "开会"）
  result = result.replace(INTENT_VERB_PATTERN, '');
  // 清理助词和标点
  return result.replace(/[，。,.\s的在帮我给提醒请]+/g, ' ').trim();
}

function detectIntent(text: string): ParsedCommand['intent'] {
  if (/删除|删掉|删了|取消|移除|去掉|清除|撤销|remove|delete/.test(text)) return 'delete';
  // 查询：用明确的查询词，不含裸"安排"（"安排"在创建指令里太常见，如"安排明天开会"）
  if (/查看|查询|有什么|有哪些|日程|看看/.test(text)) return 'query';
  // 「提前X分钟/小时提醒」是创建意图（设提醒），不要被下面的"提前"误判为 modify
  const isReminderPhrase = /提前(\d+|[一二三四五六七八九十百]+)(分钟|小时)|提前半小时/.test(text);
  // 修改：用"改到/改成/改为/改期"等动补结构，不含裸"改"（避免"改稿"这类标题误判）
  if (!isReminderPhrase && /修改|改到|改成|改为|改期|推迟|提前|延期/.test(text)) return 'modify';
  if (/总结|摘要|回顾|汇总|\bsummarize\b|\bsummary\b/i.test(text)) return 'summarize';
  if (/添加|新建|创建|加|安排|提醒|开会|会议|约|记/.test(text)) return 'create';
  return 'create';
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
  fallbackDate: Date = new Date()
): ParsedCommand {
  const intent = detectIntent(text);
  const { date, hasDate, hasTime } = parseChineseTime(text, fallbackDate);
  let resolvedDate = date;

  if (!hasDate && !hasTime) {
    // 没有日期也没有时间 → 直接使用 fallbackDate（保留点击时间格的完整时刻）
    resolvedDate = new Date(fallbackDate);
  } else if (!hasDate && hasTime && resolvedDate < fallbackDate) {
    // BUG-04: only time given (no date) and that time has already passed → default to same time tomorrow
    resolvedDate = new Date(resolvedDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const startAt = resolvedDate.toISOString();
  const endAt = extractEndTime(text, resolvedDate);
  const title = stripTimePhrases(text) || undefined;

  const reminderOffsetMin = extractReminderOffset(text);
  const reminderAt = reminderOffsetMin !== null
    ? new Date(resolvedDate.getTime() - reminderOffsetMin * 60 * 1000).toISOString()
    : undefined;

  const ambiguities: string[] = [];
  if (!hasDate) {
    if (hasTime && resolvedDate.getTime() !== date.getTime()) {
      ambiguities.push('该时间今天已过，已自动设为明天同一时刻');
    } else {
      ambiguities.push('未识别到日期，已使用当前选中日期');
    }
  }
  if (!hasTime) ambiguities.push('未识别到具体时间，已使用当前选中时间');
  if (!title) ambiguities.push('未识别到事件标题');

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
    clarificationQuestion: !title ? '请问这个事件的标题是什么？' : undefined,
  };
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
    const fallback = parseVoiceCommand(text, fallbackDate);
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
