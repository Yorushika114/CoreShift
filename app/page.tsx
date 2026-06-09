// app/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { YearGrid } from '@/components/calendar/YearGrid';
import { YearPickerPopup } from '@/components/calendar/YearPickerPopup';
import { MonthPickerPopup } from '@/components/calendar/MonthPickerPopup';
import { DayPickerPopup } from '@/components/calendar/DayPickerPopup';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { EventEditorPanel } from '@/components/voice/EventEditorPanel';
import { VoiceCommandOverlay } from '@/components/voice/VoiceCommandOverlay';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { BudgetPanel } from '@/components/budget/BudgetPanel';
import { BudgetEditModal } from '@/components/budget/BudgetEditModal';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { WEEK_HEADERS_FULL } from '@/lib/i18n';
import { reminderService } from '@/lib/reminder/reminderService';
import { formatMonthYear, formatDayTitle, getWeekStart } from '@/lib/calendar/date-utils';
import { expandEvents, realEventId } from '@/lib/calendar/recurrence';
import type { CalendarEvent } from '@/types';

type ViewMode = 'year' | 'month' | 'week' | 'day';

type UndoAction =
  | { type: 'create'; event: CalendarEvent }
  | { type: 'delete'; event: CalendarEvent }
  | { type: 'edit'; before: CalendarEvent; after: CalendarEvent };

const VIEW_TAB_VALUES: ViewMode[] = ['year', 'month', 'week', 'day'];

interface EditorState {
  open: boolean;
  event?: CalendarEvent;
  defaultStartAt?: Date;
  initialText?: string;
}

function CalendarPageInner() {
  const { bgType, bgValue, t, language } = useSettings();
  const [view, setView] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('cs_view') as ViewMode) ?? 'week'; } catch { return 'week'; }
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    try { const s = localStorage.getItem('cs_viewDate'); return s ? new Date(s) : new Date(); } catch { return new Date(); }
  });
  const [viewDate, setViewDate] = useState(() => {
    try { const s = localStorage.getItem('cs_viewDate'); return s ? new Date(s) : new Date(); } catch { return new Date(); }
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<string | undefined>();
  // 保存后滚动到该时刻，保证新建/修改的事件立即可见；导航时清除
  const [focusTime, setFocusTime] = useState<Date | null>(null);
  const [reminderToasts, setReminderToasts] = useState<{ id: string; title: string; timeStr: string }[]>([]);
  const [budgetEditOpen, setBudgetEditOpen] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const undoStackRef = useRef<UndoAction[]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => {
      setGoogleConnected(d.connected);
      if (d.connected) {
        // 页面加载时静默同步一次，拉取 Google 日历最新事项
        fetch('/api/sync', { method: 'POST' }).catch(() => {});
      }
    });
  }, []);

  // 每 5 分钟后台静默同步，保持 Google 日历事项最新
  useEffect(() => {
    if (!googleConnected) return;
    const id = setInterval(() => {
      fetch('/api/sync', { method: 'POST' }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [googleConnected]);

  useEffect(() => {
    try { localStorage.setItem('cs_view', view); } catch {}
  }, [view]);

  useEffect(() => {
    try { localStorage.setItem('cs_viewDate', viewDate.toISOString()); } catch {}
  }, [viewDate]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(language === 'zh'
          ? `同步完成：拉取 ${data.pulled} 个，推送 ${data.pushed} 个`
          : `Sync done: pulled ${data.pulled}, pushed ${data.pushed}`);
        fetchEvents(viewDate, view);
      } else {
        setSyncMsg(language === 'zh' ? '同步失败，请重试' : 'Sync failed, please retry');
      }
    } catch {
      setSyncMsg(language === 'zh' ? '同步失败，请检查网络' : 'Sync failed, check your network');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  function pushUndo(action: UndoAction) {
    undoStackRef.current = [...undoStackRef.current.slice(-19), action];
  }

  function showUndoToast(msg: string) {
    setUndoToast(msg);
    setTimeout(() => setUndoToast(null), 5000);
  }

  const handleUndoRef = useRef<() => Promise<void>>(async () => {});

  async function handleDisconnect(deleteEvents: boolean) {
    await fetch('/api/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteEvents }),
    });
    setGoogleConnected(false);
    fetchEvents(viewDate, view);
  }

  const fetchEvents = useCallback(async (date: Date, currentView: ViewMode) => {
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

    // Stale-while-revalidate：先从 localStorage 渲染缓存，再后台刷新
    const cacheKey = 'coreshift_events_cache';
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setEvents(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    try {
      setLoading(true);
      const res = await fetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reminderService.requestPermission();
    return reminderService.onFire((event) => {
      const locale = language === 'en' ? 'en-US' : 'zh-CN';
      const timeStr = new Date(event.startAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const toast = { id: event.id + Date.now(), title: event.title, timeStr };
      setReminderToasts(prev => [...prev, toast]);
      setTimeout(() => setReminderToasts(prev => prev.filter(t => t.id !== toast.id)), 8000);
    });
  }, [language]);

  useEffect(() => {
    reminderService.setLang(language);
  }, [language]);

  useEffect(() => {
    fetchEvents(viewDate, view);
  }, [viewDate, view, fetchEvents]);

  useEffect(() => {
    const es = new EventSource('/api/events/stream');
    es.onmessage = () => fetchEvents(viewDate, view);
    return () => es.close();
  }, [fetchEvents, viewDate, view]);

  // Expand recurring events over the next 7 days specifically for reminder scheduling,
  // independent of the current view range so reminders always fire correctly.
  const reminderReadyEvents = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return expandEvents(events, now, end);
  }, [events]);

  useEffect(() => {
    reminderService.scheduleAll(reminderReadyEvents);
  }, [reminderReadyEvents]);

  // Expand weekly recurring events for the current view range
  const expandedEvents = useMemo(() => {
    let start: Date, end: Date;
    if (view === 'year') {
      start = new Date(viewDate.getFullYear(), 0, 1);
      end = new Date(viewDate.getFullYear(), 11, 31, 23, 59, 59);
    } else if (view === 'month') {
      start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);
    } else if (view === 'week') {
      const ws = getWeekStart(viewDate);
      start = ws;
      end = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    } else {
      start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 0, 0, 0);
      end = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 23, 59, 59);
    }
    return expandEvents(events, start, end);
  }, [events, view, viewDate]);

  function goToToday() {
    const today = new Date();
    setFocusTime(null);
    setSelectedDate(today);
    setViewDate(today);
    setView('day');
  }

  function goPrev() {
    setFocusTime(null);
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
    setFocusTime(null);
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
    // Recurring instances have a virtual ID like "realId::isoDate"; resolve to the base event
    const originalId = realEventId(event.id);
    const original = events.find(e => e.id === originalId) ?? event;
    setEditor({ open: true, event: original });
  }

  // 语音指令路由（浮层据 intent 调用）
  function handleVoiceCreate(text: string) {
    setVoiceOpen(false);
    setEditor({ open: true, defaultStartAt: selectedDate, initialText: text });
  }

  function handleVoiceModify(patchedEvent: CalendarEvent) {
    setVoiceOpen(false);
    setEditor({ open: true, event: patchedEvent });
  }

  function handleVoiceQuery(date: Date) {
    // 跳到目标日日视图（浮层留在前面显示摘要，用户关闭后即见）
    setSelectedDate(date);
    setViewDate(date);
    setView('day');
  }

  function handleVoiceChanged() {
    fetchEvents(viewDate, view);
  }

  async function handleUndo() {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    try {
      if (action.type === 'create') {
        await fetch(`/api/events/${action.event.id}`, { method: 'DELETE' });
        showUndoToast(`已撤销：创建「${action.event.title}」`);
      } else if (action.type === 'delete') {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.event),
        });
        showUndoToast(`已撤销：删除「${action.event.title}」`);
      } else {
        await fetch(`/api/events/${action.before.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.before),
        });
        showUndoToast(`已撤销：修改「${action.after.title}」`);
      }
      fetchEvents(viewDate, view);
    } catch {
      undoStackRef.current = stack;
    }
  }

  useEffect(() => {
    handleUndoRef.current = handleUndo;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleEditorSaved(saved: CalendarEvent) {
    if (editor.event) {
      pushUndo({ type: 'edit', before: editor.event, after: saved });
      showUndoToast(language === 'zh' ? `已修改「${saved.title}」` : `Updated "${saved.title}"`);
    } else {
      pushUndo({ type: 'create', event: saved });
      showUndoToast(language === 'zh' ? `已创建「${saved.title}」` : `Created "${saved.title}"`);
    }
    const eventDate = new Date(saved.startAt);
    setEditor({ open: false });
    // 跳转到新事件所在日期+时刻，保证创建/修改后立即可见（事件可能落在当前视图范围/可视区外）
    const nextView: ViewMode = view === 'year' ? 'month' : view;
    setSelectedDate(eventDate);
    setViewDate(eventDate);
    setView(nextView);
    setFocusTime(eventDate);
    fetchEvents(eventDate, nextView);
  }

  function handleEditorDeleted(deletedEvent: CalendarEvent) {
    pushUndo({ type: 'delete', event: deletedEvent });
    showUndoToast(language === 'zh' ? `已删除「${deletedEvent.title}」` : `Deleted "${deletedEvent.title}"`);
    setEditor({ open: false });
    fetchEvents(viewDate, view);
  }

  function getNavTitle(): string {
    if (language === 'en') {
      const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (view === 'year') return `${viewDate.getFullYear()}`;
      if (view === 'month') return `${MONTHS_EN[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
      if (view === 'week') {
        const ws = getWeekStart(viewDate);
        const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
        if (ws.getMonth() === we.getMonth())
          return `${MONTHS_EN[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`;
        return `${MONTHS_EN[ws.getMonth()]} ${ws.getDate()} – ${MONTHS_EN[we.getMonth()]} ${we.getDate()}`;
      }
      const DAYS_EN = WEEK_HEADERS_FULL.en;
      return `${MONTHS_EN[viewDate.getMonth()]} ${viewDate.getDate()}, ${viewDate.getFullYear()} ${DAYS_EN[viewDate.getDay()]}`;
    }
    if (view === 'year') return `${viewDate.getFullYear()}${t('yearSuffix')}`;
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

  const prevLabel = view === 'year' ? t('prevYear') : view === 'month' ? t('prevMonth') : view === 'week' ? t('prevWeek') : t('prevDay');
  const nextLabel = view === 'year' ? t('nextYear') : view === 'month' ? t('nextMonth') : view === 'week' ? t('nextWeek') : t('nextDay');
  function openVoiceWithDraft(command?: string) {
    setVoiceDraft(command);
    setVoiceOpen(true);
  }

  return (
    <div className="flex h-screen font-sans" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 40%, #fdf4ff 100%)' }}>
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-indigo-100/60 bg-white/80 backdrop-blur-sm flex flex-col flex-shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗓</span>
            <span className="text-lg font-medium text-gray-700">CoreShift</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-sm border border-neutral-200 rounded-full px-4 py-1.5 hover:bg-neutral-50 text-neutral-600 transition-colors"
            >
              {t('today')}
            </button>
            <button
              onClick={() => openCreateEditor()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-indigo-500 hover:bg-indigo-600 rounded-full transition shadow-sm shadow-indigo-200"
            >
              <span className="text-base leading-none">+</span>
              {t('newBtn')}
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

          <BudgetPanel onEdit={() => setBudgetEditOpen(true)} />
        </div>

        {/* 弹性空白：把语音+设置推到底部 */}
        <div className="flex-1" />

        <div className="px-4 pb-4 pt-2 flex flex-col gap-3">
          {/* 侧边栏语音入口：桌面端备用入口 */}
          <button
            onClick={() => openVoiceWithDraft()}
            className="flex items-center justify-center gap-2 border border-gray-200 rounded-lg p-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-indigo-300 transition"
          >
            <span className="text-base">🎙</span>
            {t('voiceInput')}
          </button>

          <SettingsPanel
            googleConnected={googleConnected}
            syncing={syncing}
            syncMsg={syncMsg}
            onSync={handleSync}
            onDisconnect={handleDisconnect}
          />
        </div>
      </aside>

      {/* Main Area */}
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={
          bgType !== 'none' && bgValue
            ? { backgroundImage: `url(${bgValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 flex-shrink-0 bg-white/90 backdrop-blur-sm">
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
          <div className="relative flex-1 ml-1">
            <button
              onClick={() => setShowYearPicker(v => !v)}
              className="text-base font-normal text-gray-700 hover:text-blue-600 cursor-pointer"
            >
              {getNavTitle()}
            </button>
            {showYearPicker && view === 'year' && (
              <YearPickerPopup
                currentYear={viewDate.getFullYear()}
                onSelect={year => setViewDate(new Date(year, 0, 1))}
                onClose={() => setShowYearPicker(false)}
              />
            )}
            {showYearPicker && view === 'month' && (
              <MonthPickerPopup
                currentYear={viewDate.getFullYear()}
                currentMonth={viewDate.getMonth()}
                onSelect={(year, month) => setViewDate(new Date(year, month, 1))}
                onClose={() => setShowYearPicker(false)}
              />
            )}
            {showYearPicker && view === 'week' && (
              <MonthPickerPopup
                currentYear={viewDate.getFullYear()}
                currentMonth={viewDate.getMonth()}
                onSelect={(year, month) => setViewDate(new Date(year, month, 1))}
                onClose={() => setShowYearPicker(false)}
              />
            )}
            {showYearPicker && view === 'day' && (
              <DayPickerPopup
                currentDate={viewDate}
                onSelect={date => setViewDate(date)}
                onClose={() => setShowYearPicker(false)}
              />
            )}
          </div>
          {loading && (
            <span className="text-xs text-gray-400 animate-pulse">{t('loading')}</span>
          )}

          {/* View tabs */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {VIEW_TAB_VALUES.map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setShowYearPicker(false); }}
                className={`px-3 py-1 text-sm transition-colors ${
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t(v as 'year' | 'month' | 'week' | 'day')}
              </button>
            ))}
          </div>
        </div>

        {view === 'year' && (
          <YearGrid
            year={viewDate.getFullYear()}
            events={expandedEvents}
            onMonthClick={handleMonthClick}
            onNextYear={goNext}
            onPrevYear={goPrev}
          />
        )}
        {view === 'month' && (
          <MonthGrid
            viewDate={viewDate}
            events={expandedEvents}
            onDateClick={handleDayClick}
          />
        )}
        {view === 'week' && (
          <WeekView
            startDate={getWeekStart(viewDate)}
            events={expandedEvents}
            focusTime={focusTime}
            onDayClick={handleDayClick}
            onSlotClick={openCreateEditor}
            onEventClick={openEditEditor}
          />
        )}
        {view === 'day' && (
          <DayView
            date={viewDate}
            events={expandedEvents}
            focusTime={focusTime}
            onSlotClick={openCreateEditor}
            onEventClick={openEditEditor}
          />
        )}
      </main>

      {budgetEditOpen && (
        <BudgetEditModal
          onClose={() => { setBudgetEditOpen(false); }}
        />
      )}

      {editor.open && (
        <EventEditorPanel
          event={editor.event}
          defaultStartAt={editor.defaultStartAt}
          initialText={editor.initialText}
          onClose={() => setEditor({ open: false })}
          onSaved={handleEditorSaved}
          onDeleted={(ev) => handleEditorDeleted(ev)}
        />
      )}

      {voiceOpen && (
        <VoiceCommandOverlay
          onCreate={handleVoiceCreate}
          onModify={handleVoiceModify}
          onQuery={handleVoiceQuery}
          onChanged={handleVoiceChanged}
          initialText={voiceDraft}
          onClose={() => {
            setVoiceOpen(false);
            setVoiceDraft(undefined);
          }}
        />
      )}

      {/* Voice FAB - 语音优先核心入口，桌面端专用（移动端用 Action Bar） */}
      <button
        onClick={() => openVoiceWithDraft()}
        className="hidden md:flex fixed bottom-6 right-6 z-[90] items-center gap-2 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-full px-5 py-3.5 shadow-lg shadow-indigo-200 transition-all"
        aria-label={t('voiceInput')}
      >
        <span className="text-xl">🎙</span>
        <span className="text-sm font-medium">{t('voiceInputFab')}</span>
      </button>

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-full shadow-lg animate-fade-in">
          <span>✓</span>
          <span>{undoToast}</span>
          <button
            onClick={() => handleUndoRef.current()}
            className="ml-1 text-indigo-300 hover:text-white font-medium transition underline underline-offset-2"
          >
            {t('undoBtn')}
          </button>
        </div>
      )}

      {/* Reminder toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100]">
        {reminderToasts.map(toast => (
          <div
            key={toast.id}
            className="flex items-start gap-3 bg-white border border-blue-200 shadow-lg rounded-xl px-4 py-3 w-72 animate-fade-in"
          >
            <span className="text-xl">🔔</span>
            <div>
              <p className="text-sm font-medium text-gray-800">{toast.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('eventStartPrefix')} {toast.timeStr} {t('eventStartSuffix')}</p>
            </div>
            <button
              onClick={() => setReminderToasts(prev => prev.filter(x => x.id !== toast.id))}
              className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <SettingsProvider>
      <CalendarPageInner />
    </SettingsProvider>
  );
}
