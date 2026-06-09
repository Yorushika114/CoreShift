// components/calendar/MonthGrid.tsx
'use client';

import { useMemo } from 'react';
import {
  getCalendarDays,
  isToday,
  toISODateString,
} from '@/lib/calendar/date-utils';
import { EventCard } from '@/components/events/EventCard';
import { useSettings } from '@/contexts/SettingsContext';
import { WEEK_HEADERS_FULL } from '@/lib/i18n';
import type { CalendarEvent } from '@/types';

interface MonthGridProps {
  viewDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
}

export function MonthGrid({ viewDate, events, onDateClick }: MonthGridProps) {
  const { t, language } = useSettings();
  const weekHeaders = WEEK_HEADERS_FULL[language];
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
      <div className="grid grid-cols-7 border-b border-indigo-100/50 flex-shrink-0 bg-white/70 backdrop-blur-sm">
        {weekHeaders.map((h, i) => {
          const isWeekend = i === 0 || i === 6;
          return (
            <div
              key={i}
              className={`py-2 text-center text-xs font-medium ${isWeekend ? 'text-indigo-300' : 'text-neutral-400'}`}
            >
              {h}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 flex-1 overflow-auto bg-white/70" style={{ gridAutoRows: 'minmax(80px, 1fr)' }}>
        {days.map((day, i) => {
          const inMonth = day.getMonth() === viewDate.getMonth();
          const today = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
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
                'border-b border-r border-gray-200 p-1.5 cursor-pointer transition-colors',
                today ? 'bg-indigo-50/70 hover:bg-indigo-50' :
                !inMonth ? 'bg-white/30 hover:bg-white/50' :
                isWeekend ? 'bg-violet-50/70 hover:bg-violet-100/80' :
                'bg-white/60 hover:bg-white/90',
              ].join(' ')}
            >
              <div
                className={[
                  'w-7 h-7 flex items-center justify-center text-sm mb-1.5 rounded-full mx-auto transition-colors',
                  today
                    ? 'bg-indigo-500 text-white font-semibold shadow-sm shadow-indigo-200'
                    : inMonth
                    ? 'text-neutral-700'
                    : 'text-neutral-300',
                ].join(' ')}
              >
                {day.getDate()}
              </div>

              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <EventCard key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-neutral-400 pl-1">
                    +{dayEvents.length - 3} {t('more')}
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
