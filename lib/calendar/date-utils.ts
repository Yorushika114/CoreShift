// lib/calendar/date-utils.ts

export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // pad from previous month so grid starts on Sunday
  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // pad to exactly 42 (6 weeks × 7 days)
  while (days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatDateCN(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatTimeCN(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? '上午' : '下午';
  const h = hours % 12 || 12;
  return `${period}${h}:${minutes}`;
}

export function formatDate(date: Date, lang: 'zh' | 'en'): string {
  if (lang === 'en') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return formatDateCN(date);
}

export function formatTime(date: Date, lang: 'zh' | 'en'): string {
  if (lang === 'en') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return formatTimeCN(date);
}

// Uses local time to avoid UTC-offset issues in China (UTC+8)
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEK_DAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatDayTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEK_DAYS_CN[date.getDay()]}`;
}

export function formatTimeSlot(hour: number, minute: number, use24h: boolean, lang: 'zh' | 'en' = 'zh'): string {
  const mm = minute.toString().padStart(2, '0');
  if (use24h) {
    return `${hour.toString().padStart(2, '0')}:${mm}`;
  }
  const h = hour % 12 || 12;
  if (lang === 'en') {
    const period = hour < 12 ? 'AM' : 'PM';
    return `${h}:${mm} ${period}`;
  }
  const period = hour < 12 ? '上午' : '下午';
  return `${period} ${h}:${mm}`;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Returns { hours, minutes } of date in the given IANA timezone.
// Falls back to local time on invalid/missing timezone.
export function getHoursInTimezone(
  date: Date,
  timezone?: string,
): { hours: number; minutes: number } {
  if (!timezone) return { hours: date.getHours(), minutes: date.getMinutes() };
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? String(date.getHours()), 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? String(date.getMinutes()), 10);
    return { hours: h % 24, minutes: m };
  } catch {
    return { hours: date.getHours(), minutes: date.getMinutes() };
  }
}

// Returns YYYY-MM-DD of date in the given IANA timezone.
// Falls back to local date on invalid/missing timezone.
export function getDateStringInTimezone(date: Date, timezone?: string): string {
  if (!timezone) return toISODateString(date);
  try {
    // sv-SE locale reliably formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(date);
  } catch {
    return toISODateString(date);
  }
}
