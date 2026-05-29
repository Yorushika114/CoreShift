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
  focusTime?: Date | null;   // 指定滚动到的时刻（如刚保存的事件），优先于"最早事件"
  onSlotClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayView({ date, events, use24h, focusTime, onSlotClick, onEventClick }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSlotClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotIndex = Math.floor(y / SLOT_HEIGHT);
    const hour = Math.min(Math.floor(slotIndex / 2), 23);
    const minute = (slotIndex % 2) * 30;
    const clicked = new Date(date);
    clicked.setHours(hour, minute, 0, 0);
    onSlotClick(clicked);
  }

  const dateKey = toISODateString(date);
  const allDayEvents = events.filter(
    e => e.allDay && toISODateString(new Date(e.startAt)) === dateKey,
  );
  const timedEvents = events.filter(
    e => !e.allDay && toISODateString(new Date(e.startAt)) === dateKey,
  );

  const now = new Date();
  const showNowLine = isToday(date);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 30 * SLOT_HEIGHT;

  useEffect(() => {
    if (!scrollRef.current) return;
    let target: Date | null = focusTime ?? null;
    if (!target && timedEvents.length > 0) {
      target = new Date(
        timedEvents.reduce((a, b) => (new Date(a.startAt) < new Date(b.startAt) ? a : b)).startAt
      );
    }
    const scrollTop = target
      ? (target.getHours() * 60 + target.getMinutes()) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2
      : 8 * 2 * SLOT_HEIGHT; // 无目标时滚到 08:00
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [date, focusTime?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* All-day strip */}
      {allDayEvents.length > 0 && (
        <div className="flex-shrink-0 flex border-b border-gray-200 bg-gray-50">
          <div className="w-20 flex-shrink-0 text-xs text-gray-400 flex items-center justify-end pr-2 py-1">
            全天
          </div>
          <div className="flex-1 border-l border-gray-200 p-1 flex flex-col gap-0.5">
            {allDayEvents.map(event => (
              <div
                key={event.id}
                onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                className={`${colorFor(event)} text-white text-xs rounded px-2 py-0.5 truncate ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''} flex items-center gap-1`}
              >
                {event.recurrence && <span className="opacity-75">↺</span>}
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="relative"
          style={{ height: `${48 * SLOT_HEIGHT}px` }}
          onClick={handleGridClick}
        >
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
                <div className="w-20 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                  {minute === 0 && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
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
              className="absolute left-20 right-0 z-10 pointer-events-none"
              style={{ top: `${nowTop}px` }}
              data-testid="now-line"
            >
              <div className="relative border-t-2 border-red-500">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>
          )}

          {/* Timed event blocks */}
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
                data-testid={`event-block-${event.id}`}
                onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                className={`absolute left-20 right-2 rounded-md px-2 py-1 ${colorFor(event)} text-white overflow-hidden ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''}`}
                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
              >
                <div className="text-xs font-medium truncate leading-tight flex items-center gap-1">
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
      </div>
    </div>
  );
}
