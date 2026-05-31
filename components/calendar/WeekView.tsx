// components/calendar/WeekView.tsx
'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { isToday, toISODateString, formatTimeSlot, getDateStringInTimezone } from '@/lib/calendar/date-utils';
import { getHoursInTimezone } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { WEEK_HEADERS_FULL } from '@/lib/i18n';
import type { CalendarEvent } from '@/types';

const SLOT_HEIGHT = 48;

function layoutEvents(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  type Row = { event: CalendarEvent; col: number; startMs: number; endMs: number };
  const rows: Row[] = [];
  const colEnds: number[] = [];
  for (const ev of sorted) {
    const startMs = +new Date(ev.startAt);
    const endMs = ev.endAt ? +new Date(ev.endAt) : startMs + 30 * 60_000;
    let col = colEnds.findIndex(e => e <= startMs);
    if (col === -1) col = colEnds.length;
    colEnds[col] = endMs;
    rows.push({ event: ev, col, startMs, endMs });
  }
  return rows.map(row => {
    const concurrent = rows.filter(r => r.startMs < row.endMs && r.endMs > row.startMs);
    const totalCols = Math.max(...concurrent.map(r => r.col)) + 1;
    return { ...row, totalCols };
  });
}

interface WeekViewProps {
  startDate: Date;
  events: CalendarEvent[];
  focusTime?: Date | null;   // 指定滚动到的时刻（如刚保存的事件），优先于"最早事件"
  onDayClick: (date: Date) => void;
  onSlotClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function WeekView({
  startDate,
  events,
  focusTime,
  onDayClick,
  onSlotClick,
  onEventClick,
}: WeekViewProps) {
  const { use24h, timezone, t, language } = useSettings();
  const weekDays = WEEK_HEADERS_FULL[language];
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
      const key = getDateStringInTimezone(new Date(e.startAt), timezone);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events, timezone]);

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
      ? (() => { const { hours: h, minutes: m } = getHoursInTimezone(target, timezone); return (h * 60 + m) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2; })()
      : 8 * 2 * SLOT_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [startDate, focusTime?.getTime(), timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nowTop, setNowTop] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      const { hours: h, minutes: m } = getHoursInTimezone(new Date(), timezone);
      setNowTop((h * 60 + m) / 30 * SLOT_HEIGHT);
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if (!onSlotClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotIndex = Math.floor(y / SLOT_HEIGHT);
    const hour = Math.min(Math.floor(slotIndex / 2), 23);
    const minute = (slotIndex % 2) * 30;
    const clicked = new Date(day);
    clicked.setHours(hour, minute, 0, 0);
    onSlotClick(clicked);
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white/70">
      {/* Sticky header: day names + optional all-day row */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-indigo-100/50">
        <div className="flex">
          <div className="w-20 flex-shrink-0" />
          {days.map((day, i) => {
            const today = isToday(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={i}
                data-testid={`day-header-${i}`}
                onClick={() => onDayClick(day)}
                className={`flex-1 text-center py-2 cursor-pointer border-l border-gray-200 transition-colors ${today ? 'bg-indigo-50/50' : isWeekend ? 'hover:bg-violet-50/40' : 'hover:bg-indigo-50/30'}`}
              >
                <div className={`text-xs ${isWeekend ? 'text-indigo-300' : 'text-neutral-400'}`}>{weekDays[day.getDay()]}</div>
                <div
                  className={[
                    'text-lg font-medium mx-auto w-8 h-8 flex items-center justify-center rounded-full',
                    today ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-200' : 'text-neutral-800',
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
          <div className="flex border-t border-gray-200">
            <div className="w-20 flex-shrink-0 text-xs text-gray-400 flex items-center justify-end pr-2 py-1">
              {t('allDay2')}
            </div>
            {days.map((day, i) => {
              const dateKey = getDateStringInTimezone(day, timezone);
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
        <div className="w-20 flex-shrink-0 relative">
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="absolute w-full flex items-start justify-end pr-2 pt-1"
              style={{ top: `${hour * 2 * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              <span
                className="text-xs text-gray-600 whitespace-nowrap"
                style={{ textShadow: '0 0 4px #fff, 0 0 8px #fff' }}
              >
                {formatTimeSlot(hour, 0, use24h, language)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, colIndex) => {
          const dateKey = getDateStringInTimezone(day, timezone);
          const timedEvents = (eventsByDate.get(dateKey) ?? []).filter(e => !e.allDay);
          const today = isToday(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={colIndex}
              className={`flex-1 relative border-l border-gray-200 ${today ? 'bg-indigo-50/20' : isWeekend ? 'bg-violet-50/20' : ''} ${onSlotClick ? 'cursor-cell' : ''}`}
              onClick={e => handleColumnClick(e, day)}
            >
              {/* Slot grid lines */}
              {Array.from({ length: 48 }, (_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-b border-gray-200"
                  style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                />
              ))}

              {/* Current time line */}
              {today && nowTop !== null && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${nowTop}px` }}
                >
                  <div className="border-t-2 border-red-500" />
                </div>
              )}

              {/* Timed events */}
              {layoutEvents(timedEvents).map(({ event, col, totalCols }) => {
                const start = new Date(event.startAt);
                const end = event.endAt
                  ? new Date(event.endAt)
                  : new Date(start.getTime() + 30 * 60_000);
                const { hours: startH, minutes: startM } = getHoursInTimezone(start, timezone);
                const topPx = (startH * 60 + startM) / 30 * SLOT_HEIGHT;
                const durationMin = (end.getTime() - start.getTime()) / 60000;
                const heightPx = Math.max(durationMin / 30 * SLOT_HEIGHT - 1, 24);
                const isShort = heightPx < 40;
                const colW = 100 / totalCols;
                const leftPct = col * colW;

                return (
                  <div
                    key={event.id}
                    data-testid={`week-event-${event.id}`}
                    onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                    className={`absolute rounded px-1 py-0.5 ${colorFor(event)} text-white overflow-hidden ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''}`}
                    style={{
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      left: `calc(${leftPct}% + 1px)`,
                      right: `calc(${100 - leftPct - colW}% + 1px)`,
                    }}
                  >
                    <div className="text-xs font-medium truncate leading-tight flex items-center gap-0.5">
                      {event.recurrence && <span className="opacity-75 flex-shrink-0">↺</span>}
                      {event.title}
                    </div>
                    {!isShort && (
                      <div className="text-xs opacity-80">
                        {formatTimeSlot(startH, startM, use24h, language)}
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
