'use client';

import { useMemo } from 'react';
import {
  getCalendarDays,
  isToday,
  toISODateString,
} from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

interface YearGridProps {
  year: number;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
}

export function YearGrid({ year, events, onMonthClick }: YearGridProps) {
  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(toISODateString(new Date(e.startAt)));
    return set;
  }, [events]);

  return (
    <div className="grid grid-cols-3 gap-4 p-6 overflow-auto h-full">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const days = getCalendarDays(year, monthIndex);
        return (
          <div
            key={monthIndex}
            data-testid={`month-card-${monthIndex}`}
            onClick={() => onMonthClick(new Date(year, monthIndex, 1))}
            className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-blue-50 transition-colors select-none"
          >
            <div className="text-sm font-medium text-gray-700 mb-2">
              {MONTHS[monthIndex]}
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-xs text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day, i) => {
                const inMonth = day.getMonth() === monthIndex;
                const today = isToday(day);
                const hasEvent = inMonth && eventDates.has(toISODateString(day));
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className={[
                      'w-5 h-5 flex items-center justify-center text-xs rounded-full',
                      !inMonth && 'text-gray-300',
                      inMonth && !today && 'text-gray-700',
                      today && 'bg-blue-600 text-white font-bold',
                    ].filter(Boolean).join(' ')}>
                      {day.getDate()}
                    </div>
                    {hasEvent && (
                      <div
                        className="w-1 h-1 rounded-full bg-blue-400 mt-0.5"
                        data-testid="event-dot"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
