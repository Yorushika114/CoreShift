/**
 * 中文时间表达解析器
 * 支持：今天/明天/后天/大后天、下周X、X月X日、相对偏移（N天后）
 * 支持：上午/下午/早上/晚上 + N点/N点半/N点N分
 * 返回 Date 对象，解析失败返回 null
 */

const WEEKDAY_MAP: Record<string, number> = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};

const HOUR_WORDS: Record<string, number> = {
  凌晨: 0, 早上: 6, 早: 6, 上午: 9, 中午: 12, 下午: 13, 傍晚: 17, 晚上: 19, 夜: 20, 晚: 19,
};

function chineseNumToInt(s: string): number {
  const map: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
    两: 2,
  };
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.length === 1) return map[s] ?? NaN;
  // 十X → 10+X, X十 → X*10, X十Y → X*10+Y
  if (s.startsWith('十')) return 10 + (map[s[1]] ?? 0);
  if (s.endsWith('十')) return (map[s[0]] ?? NaN) * 10;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (map[a] ?? NaN) * 10 + (map[b] ?? 0);
  }
  return NaN;
}

function resolveDate(base: Date, text: string): Date | null {
  const d = new Date(base);
  d.setHours(9, 0, 0, 0); // 默认早上9点

  // 相对月份：下个月X号 / 这个月X号 / 下下个月X号
  const relMonthMatch = text.match(
    /(下下个?月|下个?月|这个?月|本月)(\d{1,2}|[一二三四五六七八九十]+)[日号]/
  );
  if (relMonthMatch) {
    const prefix = relMonthMatch[1];
    const day = chineseNumToInt(relMonthMatch[2]);
    let offset = 0;
    if (prefix.startsWith('下下')) offset = 2;
    else if (prefix.startsWith('下')) offset = 1;
    // setMonth 会自动处理跨年（如 12 月 + 1 → 次年 1 月）
    d.setMonth(d.getMonth() + offset, day);
    return d;
  }

  // 绝对日期：X月X日
  const absMatch = text.match(/(\d{1,2}|[一二三四五六七八九十]+)月(\d{1,2}|[一二三四五六七八九十]+)[日号]/);
  if (absMatch) {
    const month = chineseNumToInt(absMatch[1]) - 1;
    const day = chineseNumToInt(absMatch[2]);
    d.setMonth(month, day);
    if (d < base) d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  // 相对日期
  if (/今天|今日/.test(text)) return d;
  if (/明天|明日/.test(text)) { d.setDate(d.getDate() + 1); return d; }
  if (/大后天/.test(text)) { d.setDate(d.getDate() + 3); return d; }
  if (/后天/.test(text)) { d.setDate(d.getDate() + 2); return d; }

  // N天后
  const nDaysMatch = text.match(/(\d+|[一二三四五六七八九十]+)天[后後]/);
  if (nDaysMatch) {
    d.setDate(d.getDate() + chineseNumToInt(nDaysMatch[1]));
    return d;
  }

  // 下周X / 这周X / 本周X / 下下周X
  const weekMatch = text.match(/(下下周|下周|下个周|这周|本周|这个周)(日|天|一|二|三|四|五|六)/);
  if (weekMatch) {
    const prefix = weekMatch[1];
    const targetDay = WEEKDAY_MAP[weekMatch[2]];
    const currentDay = d.getDay();
    let delta = targetDay - currentDay;
    if (prefix.startsWith('下下')) {
      delta += delta <= 0 ? 14 : 7;
    } else if (prefix.startsWith('下') || prefix.startsWith('下个')) {
      delta += delta <= 0 ? 7 : 7;
    } else {
      // 这周/本周：取本周那天，若已过则取下周
      if (delta < 0) delta += 7;
    }
    d.setDate(d.getDate() + delta);
    return d;
  }

  return null;
}

function resolveTime(base: Date, text: string): Date {
  const d = new Date(base);

  // 提取时段前缀决定小时基准
  let hourBase = -1;
  for (const [word, h] of Object.entries(HOUR_WORDS)) {
    if (text.includes(word)) { hourBase = h; break; }
  }

  // X点Y分 / X点半 / X点
  const timeMatch = text.match(
    /(\d{1,2}|[一二三四五六七八九十两]+)[点時时]([半]|\d{1,2}|[一二三四五六七八九十零]+分?)?/
  );
  if (!timeMatch) return d;

  let hour = chineseNumToInt(timeMatch[1]);
  let minute = 0;

  if (timeMatch[2]) {
    if (timeMatch[2] === '半') {
      minute = 30;
    } else {
      const minStr = timeMatch[2].replace('分', '');
      minute = chineseNumToInt(minStr);
      if (isNaN(minute)) minute = 0;
    }
  }

  // 根据时段修正小时（下午1点 = 13点，但下午12点不变）
  if (hourBase >= 12 && hour < 12) hour += 12;
  if (hourBase === 0 && hour >= 12) hour = hour - 12; // 凌晨12点 = 0点
  if (hourBase === 6 && hour < 6) hour += 6; // 早上1点 → 7点（罕见，容错）

  d.setHours(hour, minute, 0, 0);
  return d;
}

export type ParsedTime = {
  date: Date;
  hasDate: boolean;
  hasTime: boolean;
};

export function parseChineseTime(text: string, baseDate: Date = new Date()): ParsedTime {
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  const resolvedDate = resolveDate(base, text);
  const hasDate = resolvedDate !== null;
  const workDate = resolvedDate ?? new Date(base);

  const hasTime = /[点時时]/.test(text) ||
    Object.keys(HOUR_WORDS).some(w => text.includes(w));

  const finalDate = hasTime ? resolveTime(workDate, text) : workDate;

  return { date: finalDate, hasDate, hasTime };
}
