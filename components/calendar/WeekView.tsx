// components/calendar/WeekView.tsx
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { isToday, toISODateString, formatTimeSlot } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import type { CalendarEvent } from '@/types';

const SLOT_HEIGHT = 48;
const WEEK_DAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface WeekViewProps {
  startDate: Date;
  events: CalendarEvent[];
  use24h: boolean;
  onDayClick: (date: Date) => void;
}

export function WeekView({ startDate, events, use24h, onDayClick }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [startDate]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = toISODateString(new Date(e.startAt));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const allEvents = Array.from(eventsByDate.values()).flat();
    let scrollTop: number;
    if (allEvents.length > 0) {
      const first = allEvents.reduce((a, b) =>
        new Date(a.startAt) < new Date(b.startAt) ? a : b
      );
      const d = new Date(first.startAt);
      scrollTop = (d.getHours() * 60 + d.getMinutes()) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2;
    } else {
      scrollTop = 8 * 2 * SLOT_HEIGHT;
    }
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 30 * SLOT_HEIGHT;

  return (
    // scrollRef on the outer container so header sticky works correctly,
    // and both header + grid share the same scrollbar — no width mismatch.
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {/* Sticky day column headers inside scroll container */}
      <div className="sticky top-0 z-20 flex bg-white border-b border-gray-200">
        <div className="w-16 flex-shrink-0" />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={i}
              data-testid={`day-header-${i}`}
              onClick={() => onDayClick(day)}
              className="flex-1 text-center py-2 cursor-pointer hover:bg-gray-50 border-l border-gray-200 transition-colors"
            >
              <div className="text-xs text-gray-500">{WEEK_DAYS_CN[day.getDay()]}</div>
              <div className={[
                'text-lg font-medium mx-auto w-8 h-8 flex items-center justify-center rounded-full',
                today ? 'bg-blue-600 text-white' : 'text-gray-900',
              ].join(' ')}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid content */}
      <div className="flex" style={{ height: `${48 * SLOT_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="absolute w-full flex items-start justify-end pr-2 pt-1"
                style={{ top: `${hour * 2 * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
              >
                <span className="text-xs text-gray-400">
                  {formatTimeSlot(hour, 0, use24h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIndex) => {
            const dateKey = toISODateString(day);
            const dayEvents = eventsByDate.get(dateKey) ?? [];
            const today = isToday(day);

            return (
              <div key={colIndex} className="flex-1 relative border-l border-gray-200">
                {/* Slot grid lines */}
                {Array.from({ length: 48 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-b border-gray-100"
                    style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                  />
                ))}

                {/* Current time line */}
                {today && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="border-t-2 border-red-500" />
                  </div>
                )}

                {/* Events */}
                {dayEvents.map(event => {
                  const start = new Date(event.startAt);
                  const end = event.endAt
                    ? new Date(event.endAt)
                    : new Date(start.getTime() + 30 * 60 * 1000);
                  const topPx = (start.getHours() * 60 + start.getMinutes()) / 30 * SLOT_HEIGHT;
                  const durationMin = (end.getTime() - start.getTime()) / 60000;
                  const heightPx = Math.max(durationMin / 30 * SLOT_HEIGHT, SLOT_HEIGHT * 0.5);

                  return (
                    <div
                      key={event.id}
                      data-testid={`week-event-${event.id}`}
                      className={`absolute inset-x-0.5 rounded px-1 py-0.5 ${colorFor(event.id)} text-white overflow-hidden`}
                      style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    >
                      <div className="text-xs font-medium truncate">{event.title}</div>
                      <div className="text-xs opacity-80">
                        {formatTimeSlot(start.getHours(), start.getMinutes(), use24h)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
  );
}

