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
  focusTime?: Date | null;   // 指定滚动到的时刻（如刚保存的事件），优先于"最早事件"
  onDayClick: (date: Date) => void;
  onSlotClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function WeekView({
  startDate,
  events,
  use24h,
  focusTime,
  onDayClick,
  onSlotClick,
  onEventClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [startDate],
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

  const hasAllDay = useMemo(
    () => events.some(e => e.allDay),
    [events],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    let target: Date | null = focusTime ?? null;
    if (!target) {
      const timedEvents = Array.from(eventsByDate.values())
        .flat()
        .filter(e => !e.allDay);
      if (timedEvents.length > 0) {
        target = new Date(
          timedEvents.reduce((a, b) => (new Date(a.startAt) < new Date(b.startAt) ? a : b)).startAt
        );
      }
    }
    const scrollTop = target
      ? (target.getHours() * 60 + target.getMinutes()) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2
      : 8 * 2 * SLOT_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [startDate, focusTime?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 30 * SLOT_HEIGHT;

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if (!onSlotClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const y = e.clientY - rect.top + scrollTop;
    const slotIndex = Math.floor(y / SLOT_HEIGHT);
    const hour = Math.min(Math.floor(slotIndex / 2), 23);
    const minute = (slotIndex % 2) * 30;
    const clicked = new Date(day);
    clicked.setHours(hour, minute, 0, 0);
    onSlotClick(clicked);
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      {/* Sticky header: day names + optional all-day row */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex">
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
                <div
                  className={[
                    'text-lg font-medium mx-auto w-8 h-8 flex items-center justify-center rounded-full',
                    today ? 'bg-blue-600 text-white' : 'text-gray-900',
                  ].join(' ')}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        {hasAllDay && (
          <div className="flex border-t border-gray-100">
            <div className="w-16 flex-shrink-0 text-xs text-gray-400 flex items-center justify-end pr-2 py-1">
              全天
            </div>
            {days.map((day, i) => {
              const dateKey = toISODateString(day);
              const dayAllDay = (eventsByDate.get(dateKey) ?? []).filter(e => e.allDay);
              return (
                <div key={i} className="flex-1 border-l border-gray-200 p-0.5 min-h-[24px]">
                  {dayAllDay.map(event => (
                    <div
                      key={event.id}
                      onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                      className={`${colorFor(event)} text-white text-xs rounded px-1 py-0.5 mb-0.5 truncate ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''} flex items-center gap-0.5`}
                    >
                      {event.recurrence && <span className="opacity-75 flex-shrink-0">↺</span>}
                      {event.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
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
          const timedEvents = (eventsByDate.get(dateKey) ?? []).filter(e => !e.allDay);
          const today = isToday(day);

          return (
            <div
              key={colIndex}
              className={`flex-1 relative border-l border-gray-200 ${onSlotClick ? 'cursor-cell' : ''}`}
              onClick={e => handleColumnClick(e, day)}
            >
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

              {/* Timed events */}
              {timedEvents.map(event => {
                const start = new Date(event.startAt);
                const end = event.endAt
                  ? new Date(event.endAt)
                  : new Date(start.getTime() + 30 * 60 * 1000);
                const topPx = (start.getHours() * 60 + start.getMinutes()) / 30 * SLOT_HEIGHT;
                const durationMin = (end.getTime() - start.getTime()) / 60000;
                const heightPx = Math.max(durationMin / 30 * SLOT_HEIGHT, 28);
                const isShort = heightPx < 40;

                return (
                  <div
                    key={event.id}
                    data-testid={`week-event-${event.id}`}
                    onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                    className={`absolute inset-x-0.5 rounded px-1 py-0.5 ${colorFor(event)} text-white overflow-hidden ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''}`}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  >
                    <div className="text-xs font-medium truncate leading-tight flex items-center gap-0.5">
                      {event.recurrence && <span className="opacity-75 flex-shrink-0">↺</span>}
                      {event.title}
                    </div>
                    {!isShort && (
                      <div className="text-xs opacity-80">
                        {formatTimeSlot(start.getHours(), start.getMinutes(), use24h)}
                      </div>
                    )}
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
