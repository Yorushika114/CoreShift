// components/calendar/MonthGrid.tsx
'use client';

import { useMemo } from 'react';
import {
  getCalendarDays,
  isToday,
  formatMonthYear,
  toISODateString,
} from '@/lib/calendar/date-utils';
import { EventCard } from '@/components/events/EventCard';
import type { CalendarEvent } from '@/types';

const WEEK_HEADERS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface MonthGridProps {
  viewDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
}

export function MonthGrid({ viewDate, events, onDateClick }: MonthGridProps) {
  const days = useMemo(
    () => getCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = toISODateString(new Date(event.startAt));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-6 py-3 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-normal text-gray-600">
          {formatMonthYear(viewDate)}
        </h1>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-200 flex-shrink-0">
        {WEEK_HEADERS.map(h => (
          <div
            key={h}
            className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            {h}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 overflow-auto" style={{ gridAutoRows: 'minmax(80px, 1fr)' }}>
        {days.map((day, i) => {
          const inMonth = day.getMonth() === viewDate.getMonth();
          const today = isToday(day);
          const dateKey = toISODateString(day);
          const dayEvents = (eventsByDate.get(dateKey) ?? []).sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
          });

          return (
            <div
              key={i}
              onClick={() => onDateClick(day)}
              className={[
                'border-b border-r border-gray-200 p-1 cursor-pointer transition-colors',
                !inMonth ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-blue-50',
              ].join(' ')}
            >
              <div
                className={[
                  'w-7 h-7 flex items-center justify-center text-sm mb-1 rounded-full mx-auto',
                  today
                    ? 'bg-blue-600 text-white font-bold'
                    : inMonth
                    ? 'text-gray-900'
                    : 'text-gray-400',
                ].join(' ')}
              >
                {day.getDate()}
              </div>

              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <EventCard key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-gray-500 pl-1">
                    +{dayEvents.length - 3} 更多
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
