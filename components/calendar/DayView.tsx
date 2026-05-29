// components/calendar/DayView.tsx
'use client';

import { useRef, useEffect } from 'react';
import { isToday, toISODateString, formatTimeSlot } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import type { CalendarEvent } from '@/types';

const SLOT_HEIGHT = 48; // px per 30-min slot

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  use24h: boolean;
}

export function DayView({ date, events, use24h }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateKey = toISODateString(date);
  const dayEvents = events.filter(
    e => toISODateString(new Date(e.startAt)) === dateKey
  );

  const now = new Date();
  const showNowLine = isToday(date);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 30 * SLOT_HEIGHT;

  useEffect(() => {
    if (!scrollRef.current) return;
    let scrollTop: number;
    if (dayEvents.length > 0) {
      const first = dayEvents.reduce((a, b) =>
        new Date(a.startAt) < new Date(b.startAt) ? a : b
      );
      const d = new Date(first.startAt);
      scrollTop = (d.getHours() * 60 + d.getMinutes()) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2;
    } else {
      scrollTop = 8 * 2 * SLOT_HEIGHT; // scroll to 08:00
    }
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="relative" style={{ height: `${48 * SLOT_HEIGHT}px` }}>
        {/* Time slots */}
        {Array.from({ length: 48 }, (_, i) => {
          const hour = Math.floor(i / 2);
          const minute = i % 2 === 0 ? 0 : 30;
          return (
            <div
              key={i}
              data-testid="time-slot"
              className="absolute w-full flex border-b border-gray-100"
              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                {minute === 0 && (
                  <span className="text-xs text-gray-400">
                    {formatTimeSlot(hour, 0, use24h)}
                  </span>
                )}
              </div>
              <div className="flex-1 border-l border-gray-200" />
            </div>
          );
        })}

        {/* Current time line */}
        {showNowLine && (
          <div
            className="absolute left-16 right-0 z-10 pointer-events-none"
            style={{ top: `${nowTop}px` }}
            data-testid="now-line"
          >
            <div className="relative border-t-2 border-red-500">
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
            </div>
          </div>
        )}

        {/* Event blocks */}
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
              data-testid={`event-block-${event.id}`}
              className={`absolute left-16 right-2 rounded-md px-2 py-1 ${colorFor(event.id)} text-white overflow-hidden`}
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
    </div>
  );
}
