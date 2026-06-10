// components/calendar/DayView.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { isToday, toISODateString, formatTimeSlot, getDateStringInTimezone } from '@/lib/calendar/date-utils';
import { getHoursInTimezone } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import { useSettings } from '@/contexts/SettingsContext';
import type { CalendarEvent } from '@/types';

const SLOT_HEIGHT = 48; // px per 30-min slot

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

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  focusTime?: Date | null;   // 指定滚动到的时刻（如刚保存的事件），优先于"最早事件"
  onSlotClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayView({ date, events, focusTime, onSlotClick, onEventClick }: DayViewProps) {
  const { use24h, timezone, t, language } = useSettings();
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

  const dateKey = getDateStringInTimezone(date, timezone);
  const allDayEvents = events.filter(
    e => e.allDay && getDateStringInTimezone(new Date(e.startAt), timezone) === dateKey,
  );
  const timedEvents = events.filter(
    e => !e.allDay && getDateStringInTimezone(new Date(e.startAt), timezone) === dateKey,
  );
  // 在此日期之前开始、并延续到此日期的跨天事件
  const continuationEvents = events.filter(e => {
    if (e.allDay || !e.endAt) return false;
    const startDay = getDateStringInTimezone(new Date(e.startAt), timezone);
    const endDay = getDateStringInTimezone(new Date(e.endAt), timezone);
    if (startDay === dateKey || endDay < dateKey) return false;
    // ends on or after this day, but started before
    if (endDay === dateKey) {
      const { hours, minutes } = getHoursInTimezone(new Date(e.endAt), timezone);
      return !(hours === 0 && minutes === 0);
    }
    return true;
  });

  const showNowLine = isToday(date);
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

  useEffect(() => {
    if (!scrollRef.current) return;
    let target: Date | null = focusTime ?? null;
    if (!target && timedEvents.length > 0) {
      target = new Date(
        timedEvents.reduce((a, b) => (new Date(a.startAt) < new Date(b.startAt) ? a : b)).startAt
      );
    }
    const scrollTop = target
      ? (() => { const { hours: h, minutes: m } = getHoursInTimezone(target, timezone); return (h * 60 + m) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2; })()
      : 8 * 2 * SLOT_HEIGHT; // 无目标时滚到 08:00
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [date, focusTime?.getTime(), timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white/80">
      {/* All-day strip */}
      {allDayEvents.length > 0 && (
        <div className="flex-shrink-0 flex border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="w-14 flex-shrink-0 text-xs text-gray-400 flex items-center justify-end pr-1 py-1 sm:w-16 md:w-20 md:pr-2">
            {t('allDay2')}
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
                className={`absolute w-full flex ${minute === 0 ? 'border-b border-gray-200' : 'border-b border-gray-100'}`}
                style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
              >
                <div className="w-14 flex-shrink-0 flex items-start justify-end pr-1 pt-1 sm:w-16 md:w-20 md:pr-3">
                  {minute === 0 && (
                    <span
                      className="text-[11px] text-gray-500 whitespace-nowrap md:text-xs md:text-gray-600"
                      style={{ textShadow: '0 0 4px #fff, 0 0 8px #fff' }}
                    >
                      {formatTimeSlot(hour, 0, use24h, language)}
                    </span>
                  )}
                </div>
                <div className="flex-1 border-l border-gray-200" />
              </div>
            );
          })}

          {/* Current time line */}
          {showNowLine && nowTop !== null && (
            <div
              className="absolute left-14 right-0 z-10 pointer-events-none sm:left-16 md:left-20"
              style={{ top: `${nowTop}px` }}
              data-testid="now-line"
            >
              <div className="relative border-t-2 border-red-500">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
              </div>
            </div>
          )}

          {/* Timed event blocks — wrapper offsets the time-label column */}
          <div className="absolute left-14 right-2 top-0 bottom-0 pointer-events-none sm:left-16 md:left-20">
            {/* Cross-day continuation segments */}
            {continuationEvents.map(event => {
              const endDay = getDateStringInTimezone(new Date(event.endAt!), timezone);
              const isLastSeg = endDay === dateKey;
              const heightPx = isLastSeg
                ? Math.max((() => { const { hours: h, minutes: m } = getHoursInTimezone(new Date(event.endAt!), timezone); return (h * 60 + m) / 30 * SLOT_HEIGHT - 1; })(), 24)
                : 48 * SLOT_HEIGHT - 1;
              return (
                <div
                  key={`cont-${event.id}`}
                  data-testid={`event-block-cont-${event.id}`}
                  onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                  className={`absolute rounded-md px-2 py-1 pointer-events-auto ${colorFor(event)} text-white overflow-hidden opacity-90 ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''}`}
                  style={{ top: 0, height: `${heightPx}px`, left: '1px', right: '1px' }}
                >
                  <div className="text-xs font-medium truncate leading-tight flex items-center gap-1">
                    {event.recurrence && <span className="opacity-75 flex-shrink-0">↺</span>}
                    {event.title}
                  </div>
                  <div className="text-xs opacity-80">00:00</div>
                </div>
              );
            })}
            {layoutEvents(timedEvents).map(({ event, col, totalCols }) => {
              const start = new Date(event.startAt);
              const end = event.endAt
                ? new Date(event.endAt)
                : new Date(start.getTime() + 30 * 60_000);
              const { hours: startH, minutes: startM } = getHoursInTimezone(start, timezone);
              const topPx = (startH * 60 + startM) / 30 * SLOT_HEIGHT;
              const durationMin = (end.getTime() - start.getTime()) / 60000;
              const maxHeightPx = 48 * SLOT_HEIGHT - topPx;
              const heightPx = Math.min(Math.max(durationMin / 30 * SLOT_HEIGHT - 1, 24), maxHeightPx);
              const isShort = heightPx < 40;
              const colW = 100 / totalCols;
              const leftPct = col * colW;

              return (
                <div
                  key={event.id}
                  data-testid={`event-block-${event.id}`}
                  onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                  className={`absolute rounded-md px-2 py-1 pointer-events-auto ${colorFor(event)} text-white overflow-hidden ${onEventClick ? 'cursor-pointer hover:brightness-110' : ''}`}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: `calc(${leftPct}% + 1px)`,
                    right: `calc(${100 - leftPct - colW}% + 1px)`,
                  }}
                >
                  <div className="text-xs font-medium truncate leading-tight flex items-center gap-1">
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
        </div>
      </div>
    </div>
  );
}
