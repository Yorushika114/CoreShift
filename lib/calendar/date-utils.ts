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

export function formatTimeSlot(hour: number, minute: number, use24h: boolean): string {
  const mm = minute.toString().padStart(2, '0');
  if (use24h) {
    return `${hour.toString().padStart(2, '0')}:${mm}`;
  }
  const period = hour < 12 ? '上午' : '下午';
  const h = hour % 12 || 12;
  return `${period} ${h}:${mm}`;
}
