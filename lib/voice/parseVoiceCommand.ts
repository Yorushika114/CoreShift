import { parseChineseTime } from './parseChineseTime';
import type { ParsedCommand } from '@/types';

// 时间相关词汇，用于从原文中剥离出标题
const TIME_PATTERNS = [
  /(\d{1,2}|[一二三四五六七八九十两]+)[点時时][半]?(\d{1,2}|[一二三四五六七八九十零]+分?)?/,
  /(下下周|下周|下个周|这周|本周|这个周)(日|天|一|二|三|四|五|六)/,
  /(下下个?月|下个?月|这个?月|本月)(\d{1,2}|[一二三四五六七八九十]+)[日号]/,
  /(\d{1,2}|[一二三四五六七八九十]+)月(\d{1,2}|[一二三四五六七八九十]+)[日号]/,
  /(\d+|[一二三四五六七八九十]+)天[后後]/,
  /大后天|今天|今日|明天|明日|后天/,
  /凌晨|早上|上午|中午|下午|傍晚|晚上|夜晚?|晚/,
  /到(\d{1,2}|[一二三四五六七八九十两]+)[点時时]/,
];

function stripTimePhrases(text: string): string {
  let result = text;
  for (const p of TIME_PATTERNS) {
    result = result.replace(new RegExp(p.source, 'g'), '');
  }
  // 清理助词和标点
  return result.replace(/[，。,.\s的在帮我提醒请]+/g, ' ').trim();
}

function detectIntent(text: string): ParsedCommand['intent'] {
  if (/删除|取消|移除|remove|delete/.test(text)) return 'delete';
  if (/查看|查询|有什么|有哪些|安排|日程|看看/.test(text)) return 'query';
  if (/修改|改|更新|推迟|提前|延期/.test(text)) return 'modify';
  if (/添加|新建|创建|加|安排|提醒|开会|会议|约|记/.test(text)) return 'create';
  return 'create'; // 默认尝试创建
}

// 提取结束时间（"X点到Y点"中的Y点）
function extractEndTime(text: string, startDate: Date): string | undefined {
  const endMatch = text.match(/到(\d{1,2}|[一二三四五六七八九十两]+)[点時时]([半]|\d{1,2})?/);
  if (!endMatch) return undefined;
  const endText = endMatch[0].replace(/^到/, '');
  // 从原文中找时段前缀
  const periodMatch = text.match(/(上午|下午|早上|晚上)/);
  const fullEndText = periodMatch ? `${periodMatch[0]}${endText}` : endText;
  const { date } = parseChineseTime(fullEndText, startDate);
  if (date <= startDate) date.setDate(date.getDate() + 1); // 跨天容错
  return date.toISOString();
}

export function parseVoiceCommand(
  text: string,
  fallbackDate: Date = new Date()
): ParsedCommand {
  const intent = detectIntent(text);
  const { date, hasDate, hasTime } = parseChineseTime(text, fallbackDate);
  const startAt = date.toISOString();

  const endAt = extractEndTime(text, date);
  const title = stripTimePhrases(text) || undefined;

  const ambiguities: string[] = [];
  if (!hasDate) ambiguities.push('未识别到日期，已使用当前选中日期');
  if (!hasTime) ambiguities.push('未识别到具体时间，已设为上午9:00');
  if (!title) ambiguities.push('未识别到事件标题');

  return {
    intent,
    title: title || undefined,
    startAt,
    endAt,
    ambiguities,
    clarificationNeeded: !title,
    clarificationQuestion: !title ? '请问这个事件的标题是什么？' : undefined,
  };
}
