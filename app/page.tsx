// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { YearGrid } from '@/components/calendar/YearGrid';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { EventEditorPanel } from '@/components/voice/EventEditorPanel';
import { formatMonthYear, formatDayTitle, getWeekStart } from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

type ViewMode = 'year' | 'month' | 'week' | 'day';

const VIEW_TABS: { label: string; value: ViewMode }[] = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '日', value: 'day' },
];

interface EditorState {
  open: boolean;
  event?: CalendarEvent;
  defaultStartAt?: Date;
}

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [use24h, setUse24h] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('use24h');
    return saved === null ? true : saved === 'true';
  });

  const fetchEvents = useCallback(async (date: Date, currentView: ViewMode) => {
    setLoading(true);
    try {
      let start: Date, end: Date;
      if (currentView === 'year') {
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
      } else if (currentView === 'month') {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      } else if (currentView === 'week') {
        const ws = getWeekStart(date);
        start = ws;
        end = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else {
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      }
      const res = await fetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(viewDate, view);
  }, [viewDate, view, fetchEvents]);

  function handleUse24hChange(value: boolean) {
    setUse24h(value);
    localStorage.setItem('use24h', String(value));
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setViewDate(today);
    setView('day');
  }

  function goPrev() {
    if (view === 'year')
      setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1));
    else if (view === 'month')
      setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === 'week')
      setViewDate(d => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000));
    else
      setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }

  function goNext() {
    if (view === 'year')
      setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1));
    else if (view === 'month')
      setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === 'week')
      setViewDate(d => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000));
    else
      setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }

  function handleMonthClick(date: Date) {
    setViewDate(date);
    setView('month');
  }

  function handleDayClick(date: Date) {
    setSelectedDate(date);
    setViewDate(date);
    setView('day');
  }

  function openCreateEditor(defaultStartAt?: Date) {
    setEditor({ open: true, defaultStartAt: defaultStartAt ?? selectedDate });
  }

  function openEditEditor(event: CalendarEvent) {
    setEditor({ open: true, event });
  }

  function handleEditorSaved(saved: CalendarEvent) {
    setEditor({ open: false });
    fetchEvents(viewDate, view);
  }

  function handleEditorDeleted() {
    setEditor({ open: false });
    fetchEvents(viewDate, view);
  }

  function getNavTitle(): string {
    if (view === 'year') return `${viewDate.getFullYear()}年`;
    if (view === 'month') return formatMonthYear(viewDate);
    if (view === 'week') {
      const ws = getWeekStart(viewDate);
      const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) return `${ws.getMonth() + 1}月${ws.getDate()}日 - ${we.getDate()}日`;
      return `${ws.getMonth() + 1}月${ws.getDate()}日 - ${we.getMonth() + 1}月${we.getDate()}日`;
    }
    return formatDayTitle(viewDate);
  }

  const prevLabel = view === 'year' ? '上一年' : view === 'month' ? '上个月' : view === 'week' ? '上一周' : '前一天';
  const nextLabel = view === 'year' ? '下一年' : view === 'month' ? '下个月' : view === 'week' ? '下一周' : '后一天';

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-gray-200 flex flex-col p-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗓</span>
          <span className="text-lg font-medium text-gray-700">CoreShift</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="text-sm border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => openCreateEditor()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-full transition shadow-sm"
          >
            <span className="text-base leading-none">+</span>
            新建
          </button>
        </div>

        <MiniCalendar
          selectedDate={selectedDate}
          onDateSelect={date => {
            setSelectedDate(date);
            setViewDate(date);
            setView('day');
          }}
        />

        <div className="mt-auto flex flex-col gap-3">
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">🕐 时间格式</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUse24hChange(false)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  !use24h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                12小时
              </button>
              <button
                onClick={() => handleUse24hChange(true)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  use24h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                24小时
              </button>
            </div>
          </div>

          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
            🎙 语音输入（即将上线）
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label={prevLabel}
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label={nextLabel}
          >
            ›
          </button>
          <h2 className="text-base font-normal text-gray-700 ml-1 flex-1">
            {getNavTitle()}
          </h2>
          {loading && (
            <span className="text-xs text-gray-400 animate-pulse">加载中…</span>
          )}

          {/* View tabs */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setView(tab.value)}
                className={`px-3 py-1 text-sm transition-colors ${
                  view === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'year' && (
          <YearGrid
            year={viewDate.getFullYear()}
            events={events}
            onMonthClick={handleMonthClick}
          />
        )}
        {view === 'month' && (
          <MonthGrid
            viewDate={viewDate}
            events={events}
            onDateClick={handleDayClick}
          />
        )}
        {view === 'week' && (
          <WeekView
            startDate={getWeekStart(viewDate)}
            events={events}
            use24h={use24h}
            onDayClick={handleDayClick}
            onSlotClick={openCreateEditor}
            onEventClick={openEditEditor}
          />
        )}
        {view === 'day' && (
          <DayView
            date={viewDate}
            events={events}
            use24h={use24h}
            onSlotClick={openCreateEditor}
            onEventClick={openEditEditor}
          />
        )}
      </main>

      {editor.open && (
        <EventEditorPanel
          event={editor.event}
          defaultStartAt={editor.defaultStartAt}
          onClose={() => setEditor({ open: false })}
          onSaved={handleEditorSaved}
          onDeleted={handleEditorDeleted}
        />
      )}
    </div>
  );
}
