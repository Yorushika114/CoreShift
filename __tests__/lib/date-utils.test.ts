// __tests__/lib/date-utils.test.ts
import {
  getCalendarDays,
  isSameDay,
  isToday,
  formatMonthYear,
  formatTimeCN,
  toISODateString,
  formatDayTitle,
  formatTimeSlot,
} from '@/lib/calendar/date-utils';

describe('getCalendarDays', () => {
  it('returns exactly 42 days', () => {
    expect(getCalendarDays(2026, 4).length).toBe(42);
  });

  it('first day is always Sunday (getDay() === 0)', () => {
    const days = getCalendarDays(2026, 4);
    expect(days[0].getDay()).toBe(0);
  });

  it('contains all 31 days of May 2026', () => {
    const days = getCalendarDays(2026, 4);
    const mayDays = days.filter(d => d.getMonth() === 4 && d.getFullYear() === 2026);
    expect(mayDays.length).toBe(31);
  });

  it('handles February in a leap year', () => {
    const days = getCalendarDays(2024, 1); // Feb 2024
    const febDays = days.filter(d => d.getMonth() === 1 && d.getFullYear() === 2024);
    expect(febDays.length).toBe(29);
  });
});

describe('isSameDay', () => {
  it('returns true for the same day', () => {
    expect(isSameDay(new Date(2026, 4, 29), new Date(2026, 4, 29))).toBe(true);
  });

  it('returns false for different days', () => {
    expect(isSameDay(new Date(2026, 4, 29), new Date(2026, 4, 30))).toBe(false);
  });

  it('ignores time component', () => {
    expect(
      isSameDay(new Date(2026, 4, 29, 0, 0), new Date(2026, 4, 29, 23, 59))
    ).toBe(true);
  });
});

describe('formatMonthYear', () => {
  it('formats month and year in Chinese', () => {
    expect(formatMonthYear(new Date(2026, 4, 1))).toBe('2026年5月');
  });

  it('handles January', () => {
    expect(formatMonthYear(new Date(2026, 0, 1))).toBe('2026年1月');
  });
});

describe('formatTimeCN', () => {
  it('formats morning time', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 9, 0))).toBe('上午9:00');
  });

  it('formats afternoon time', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 15, 30))).toBe('下午3:30');
  });

  it('formats noon as 下午12:00', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 12, 0))).toBe('下午12:00');
  });

  it('formats midnight as 上午12:00', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 0, 0))).toBe('上午12:00');
  });

  it('pads minutes with zero', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 9, 5))).toBe('上午9:05');
  });
});

describe('toISODateString', () => {
  it('returns YYYY-MM-DD using local time', () => {
    expect(toISODateString(new Date(2026, 4, 29))).toBe('2026-05-29');
  });

  it('pads month and day', () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDayTitle', () => {
  it('formats date with weekday in Chinese', () => {
    // 2026-05-29 is a Friday (周五)
    expect(formatDayTitle(new Date(2026, 4, 29))).toBe('2026年5月29日 周五');
  });

  it('formats Monday correctly', () => {
    // 2026-05-25 is a Monday (周一)
    expect(formatDayTitle(new Date(2026, 4, 25))).toBe('2026年5月25日 周一');
  });

  it('formats Tuesday correctly', () => {
    // 2026-05-26 is a Tuesday (周二)
    expect(formatDayTitle(new Date(2026, 4, 26))).toBe('2026年5月26日 周二');
  });
});

describe('formatTimeSlot', () => {
  it('formats 24h midnight', () => {
    expect(formatTimeSlot(0, 0, true)).toBe('00:00');
  });

  it('formats 24h afternoon', () => {
    expect(formatTimeSlot(15, 30, true)).toBe('15:30');
  });

  it('formats 24h pads single-digit hour', () => {
    expect(formatTimeSlot(9, 0, true)).toBe('09:00');
  });

  it('formats 12h morning', () => {
    expect(formatTimeSlot(9, 0, false)).toBe('上午 9:00');
  });

  it('formats 12h afternoon', () => {
    expect(formatTimeSlot(15, 30, false)).toBe('下午 3:30');
  });

  it('formats 12h noon as 下午 12:00', () => {
    expect(formatTimeSlot(12, 0, false)).toBe('下午 12:00');
  });

  it('formats 12h midnight as 上午 12:00', () => {
    expect(formatTimeSlot(0, 0, false)).toBe('上午 12:00');
  });
});
