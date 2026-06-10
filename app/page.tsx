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
import { MobileVoiceFab } from '@/components/voice/MobileVoiceFab';
import { VoiceCommandOverlay } from '@/components/voice/VoiceCommandOverlay';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { BudgetPanel } from '@/components/budget/BudgetPanel';
import { AppIcon } from '@/components/ui/AppIcon';
import { BudgetEditModal } from '@/components/budget/BudgetEditModal';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { WEEK_HEADERS_FULL } from '@/lib/i18n';
import { reminderService } from '@/lib/reminder/reminderService';
import { formatMonthYear, formatDayTitle, getWeekStart } from '@/lib/calendar/date-utils';
import { expandEvents, realEventId } from '@/lib/calendar/recurrence';
import { useSpeechRecognition } from '@/lib/voice/useSpeechRecognition';
import type { CalendarEvent } from '@/types';

type ViewMode = 'year' | 'month' | 'week' | 'day';

type UndoAction =
  | { type: 'create'; event: CalendarEvent }
  | { type: 'delete'; event: CalendarEvent }
  | { type: 'edit'; before: CalendarEvent; after: CalendarEvent };

const VIEW_TAB_VALUES: ViewMode[] = ['year', 'month', 'week', 'day'];

function readStoredCount(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(key) ?? '0');
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

interface EditorState {
  open: boolean;
  event?: CalendarEvent;
  defaultStartAt?: Date;
  initialText?: string;
}

function CalendarPageInner() {
  const { bgType, bgValue, t, language } = useSettings();
  const [view, setView] = useState<ViewMode>('week');
  const [viewReady, setViewReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const undoStackRef = useRef<UndoAction[]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const [voiceDirectProcess, setVoiceDirectProcess] = useState(false);
  // 浮层打开后是否自动开始录音：FAB 打开为 true；空格场景为 false（空格本身已是唯一 ASR）
  const [voiceAutoListen, setVoiceAutoListen] = useState(true);
  const [isSpaceListening, setIsSpaceListening] = useState(false);
  const [hasUsedSpaceShortcut, setHasUsedSpaceShortcut] = useState(false);
  const [voiceButtonClicksWithoutSpace, setVoiceButtonClicksWithoutSpace] = useState(0);
  const [voiceShortcutToastCount, setVoiceShortcutToastCount] = useState(0);
  const [voiceShortcutToast, setVoiceShortcutToast] = useState(false);
  const isSpaceListeningRef = useRef(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const voiceOpenRef = useRef(false);
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spaceRecognizedRef = useRef('');
  // 空格松开后处于"等待 ASR 结果"状态；结果到达（或兜底超时）再打开浮层
  const spacePendingResultRef = useRef(false);
  const spaceOpenFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceShortcutToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showVoiceShortcutToast() {
    setVoiceShortcutToast(true);
    if (voiceShortcutToastTimerRef.current) {
      clearTimeout(voiceShortcutToastTimerRef.current);
    }
    voiceShortcutToastTimerRef.current = setTimeout(() => {
      setVoiceShortcutToast(false);
      voiceShortcutToastTimerRef.current = null;
    }, 2600);
  }

  function markSpaceShortcutUsed() {
    if (!hasUsedSpaceShortcut) setHasUsedSpaceShortcut(true);
    setVoiceButtonClicksWithoutSpace(0);
    try {
      localStorage.setItem('cs_voice_space_used', 'true');
      localStorage.setItem('cs_voice_button_clicks_without_space', '0');
    } catch {}
  }

  function registerVoiceButtonOpen() {
    if (hasUsedSpaceShortcut) return;
    const nextClicks = voiceButtonClicksWithoutSpace + 1;
    setVoiceButtonClicksWithoutSpace(nextClicks);
    try { localStorage.setItem('cs_voice_button_clicks_without_space', String(nextClicks)); } catch {}

    if (nextClicks >= 8 && voiceShortcutToastCount < 2) {
      const nextToastCount = voiceShortcutToastCount + 1;
      setVoiceShortcutToastCount(nextToastCount);
      setVoiceButtonClicksWithoutSpace(0);
      try {
        localStorage.setItem('cs_voice_shortcut_toast_count', String(nextToastCount));
        localStorage.setItem('cs_voice_button_clicks_without_space', '0');
      } catch {}
      showVoiceShortcutToast();
    }
  }

  useEffect(() => {
    try {
      const savedView = localStorage.getItem('cs_view') as ViewMode;
      if (savedView && VIEW_TAB_VALUES.includes(savedView)) setView(savedView);
      const savedDate = localStorage.getItem('cs_viewDate');
      if (savedDate) { const d = new Date(savedDate); setViewDate(d); setSelectedDate(d); }
      setHasUsedSpaceShortcut(localStorage.getItem('cs_voice_space_used') === 'true');
      setVoiceButtonClicksWithoutSpace(readStoredCount('cs_voice_button_clicks_without_space'));
      setVoiceShortcutToastCount(readStoredCount('cs_voice_shortcut_toast_count'));
    } catch {}
    setViewReady(true);
  }, []);

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(d => {
      setGoogleConnected(d.connected);
      if (d.connected) {
        // 页面加载时静默同步一次，拉取 Google 日历最新事项
        fetch('/api/sync', { method: 'POST' }).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (voiceShortcutToastTimerRef.current) clearTimeout(voiceShortcutToastTimerRef.current);
    };
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
    if (!viewReady) return;
    try { localStorage.setItem('cs_view', view); } catch {}
  }, [view, viewReady]);

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
          ? `同步完成：拉取 ${data.pulled} 个，推送 ${data.pushed} 个，删除 ${data.deleted} 个`
          : `Sync done: pulled ${data.pulled}, pushed ${data.pushed}, deleted ${data.deleted}`);
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
    // Cancel any in-flight fetch to prevent stale responses overwriting newer data
    fetchAbortRef.current?.abort();
    const abort = new AbortController();
    fetchAbortRef.current = abort;

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

    // Stale-while-revalidate with per-view cache keys so week cache never bleeds into day view
    const cacheKey = `coreshift_events_cache_${currentView}`;
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
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`,
        { signal: abort.signal }
      );
      if (res.ok) {
        const data = await res.json();
        if (!abort.signal.aborted) {
          setEvents(data);
          try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
        }
      }
    } catch {
      // AbortError is expected when cancelled; other errors are silent
    } finally {
      if (!abort.signal.aborted) setLoading(false);
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

  function getMobileNavTitle(): string {
    if (language === 'en') {
      const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (view === 'year') return `${viewDate.getFullYear()}`;
      return `${MONTHS_EN[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
    if (view === 'year') return `${viewDate.getFullYear()}${t('yearSuffix')}`;
    return `${viewDate.getMonth() + 1}月`;
  }

  const prevLabel = view === 'year' ? t('prevYear') : view === 'month' ? t('prevMonth') : view === 'week' ? t('prevWeek') : t('prevDay');
  const nextLabel = view === 'year' ? t('nextYear') : view === 'month' ? t('nextMonth') : view === 'week' ? t('nextWeek') : t('nextDay');

  const { start: spaceStart, stop: spaceStop, warmup: spaceWarmup, cancel: spaceCancel } = useSpeechRecognition({
    lang: language === 'en' ? 'en-US' : 'zh-CN',
    onResult: (text) => {
      if (text) spaceRecognizedRef.current = text;
      // 空格松开后处于"等待 ASR 结果"状态，结果到达立即打开浮层
      if (spacePendingResultRef.current && !voiceOpenRef.current) {
        spacePendingResultRef.current = false;
        if (spaceOpenFallbackTimerRef.current) {
          clearTimeout(spaceOpenFallbackTimerRef.current);
          spaceOpenFallbackTimerRef.current = null;
        }
        if (text) {
          setVoiceDraft(text);
          setVoiceDirectProcess(true);
          setVoiceAutoListen(false);
          setVoiceOpen(true);
        } else {
          // 未识别到语音：打开浮层但不自动录音（空格已是唯一 ASR），让用户重试或改文字
          setVoiceAutoListen(false);
          setVoiceOpen(true);
        }
      }
    },
  });
  const spaceStartRef = useRef(spaceStart);
  const spaceStopRef = useRef(spaceStop);
  const spaceWarmupRef = useRef(spaceWarmup);
  const spaceCancelRef = useRef(spaceCancel);
  useEffect(() => { spaceStartRef.current = spaceStart; }, [spaceStart]);
  useEffect(() => { spaceStopRef.current = spaceStop; }, [spaceStop]);
  useEffect(() => { spaceWarmupRef.current = spaceWarmup; }, [spaceWarmup]);
  useEffect(() => { spaceCancelRef.current = spaceCancel; }, [spaceCancel]);
  useEffect(() => { voiceOpenRef.current = voiceOpen; }, [voiceOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' && !e.repeat && !voiceOpenRef.current && !isSpaceListeningRef.current) {
        e.preventDefault();
        // 立即预热：建立讯飞 WS 并开始采集（握手期间音频缓存），消除 2.5s 握手延迟
        spaceWarmupRef.current();
        spaceHoldTimerRef.current = setTimeout(() => {
          // 计时器已触发，清空 ref，避免 keyup 误判为短按而调用 cancel()
          spaceHoldTimerRef.current = null;
          isSpaceListeningRef.current = true;
          setIsSpaceListening(true);
          spaceRecognizedRef.current = '';
          spaceStartRef.current();
        }, 500);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== ' ') return;
      if (spaceHoldTimerRef.current) {
        // 短按（未达 500ms）：取消预热，丢弃已采集音频，不打开浮层
        clearTimeout(spaceHoldTimerRef.current);
        spaceHoldTimerRef.current = null;
        spaceCancelRef.current();
      }
      if (isSpaceListeningRef.current) {
        spaceStopRef.current();
        isSpaceListeningRef.current = false;
        setIsSpaceListening(false);
        markSpaceShortcutUsed();
        // 不能在此处同步读 spaceRecognizedRef：stop() 已通知讯飞结束音频，
        // 但最终识别结果通过 WebSocket 异步返回，此时 ref 还是空的。
        // 改为设 pending 标记，等 onResult 回调到达后再打开浮层。
        spacePendingResultRef.current = true;
        // 兜底：4s 内若无结果（网络差/无语音），仍打开浮层供用户手动输入
        spaceOpenFallbackTimerRef.current = setTimeout(() => {
          if (spacePendingResultRef.current && !voiceOpenRef.current) {
            spacePendingResultRef.current = false;
            spaceOpenFallbackTimerRef.current = null;
            setVoiceAutoListen(false);
            setVoiceOpen(true);
          }
        }, 4000);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function openVoiceWithDraft(command?: string) {
    setVoiceDraft(command);
    setVoiceAutoListen(true);
    setVoiceOpen(true);
  }

  function handleVoiceButtonOpen() {
    registerVoiceButtonOpen();
    openVoiceWithDraft();
  }

  return (
    <div className="flex h-screen font-sans" style={{ background: 'linear-gradient(135deg, #eef4fb 0%, #f7f9fc 48%, #ffffff 100%)' }}>
      {/* Left Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-200/80 bg-[#f7f9fc]/90 backdrop-blur-sm flex-col flex-shrink-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <AppIcon name="calendar" className="h-[18px] w-[18px]" />
            </span>
            <span className="text-lg font-medium text-slate-800">CoreShift</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-sm border border-slate-200 rounded-lg px-4 py-1.5 hover:bg-white text-slate-600 transition-colors"
            >
              {t('today')}
            </button>
            <button
              onClick={() => openCreateEditor()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm"
            >
              <AppIcon name="plus" className="h-4 w-4" />
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

        {/* 弹性空白：把设置推到底部 */}
        <div className="flex-1" />

        <div className="px-4 pb-4 pt-2 flex flex-col gap-3">
          <button
            onClick={handleVoiceButtonOpen}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-lg px-4 py-2.5 shadow-sm transition-all text-sm font-medium"
          >
            <AppIcon name="mic" className="h-[18px] w-[18px]" />
            <span>{t('voiceInputFab')}</span>
          </button>
          {!hasUsedSpaceShortcut && voiceShortcutToastCount === 0 && (
            <p className="-mt-1 px-1 text-xs text-slate-400">{t('voiceQuickHint')}</p>
          )}
          <SettingsPanel
            googleConnected={googleConnected}
            syncing={syncing}
            syncMsg={syncMsg}
            onSync={handleSync}
            onDisconnect={handleDisconnect}
            onNavigate={(date) => {
              setViewDate(date);
              setSelectedDate(date);
              setView('month');
            }}
          />
        </div>
      </aside>

      {/* Main Area */}
      <main
        className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0"
        style={
          bgType !== 'none' && bgValue
            ? { backgroundImage: `url(${bgValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <div className="md:hidden flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-2 px-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
              aria-label={language === 'zh' ? '打开菜单' : 'Open menu'}
            >
              <AppIcon name="list" className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setShowYearPicker(v => !v)}
              className="inline-flex min-w-0 flex-1 items-center gap-1 text-left text-2xl font-medium text-slate-900"
            >
              <span className="truncate">{getMobileNavTitle()}</span>
              <AppIcon name="chevron-down" className="h-4 w-4 flex-shrink-0 text-slate-500" />
            </button>
            {loading && (
              <span className="text-xs text-gray-400 animate-pulse">{t('loading')}</span>
            )}
            <button
              type="button"
              onClick={goToToday}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
              aria-label={t('today')}
            >
              <span className="relative flex h-6 w-6 items-center justify-center rounded-md border-2 border-slate-600 text-[11px] font-semibold leading-none">
                {new Date().getDate()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openCreateEditor()}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
              aria-label={t('newBtn')}
            >
              <AppIcon name="plus" className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2">
            <button
              onClick={goPrev}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              aria-label={prevLabel}
            >
              <AppIcon name="chevron-left" className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              aria-label={nextLabel}
            >
              <AppIcon name="chevron-right" className="h-5 w-5" />
            </button>
            {VIEW_TAB_VALUES.filter(v => v !== 'year').map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setShowYearPicker(false); }}
                className={`h-9 flex-shrink-0 rounded-full px-4 text-sm transition-colors ${
                  view === v
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-slate-600 active:bg-slate-100'
                }`}
              >
                {t(v as 'month' | 'week' | 'day')}
              </button>
            ))}
          </div>
          <div className="relative px-3">
            {showYearPicker && view === 'year' && (
              <YearPickerPopup
                currentYear={viewDate.getFullYear()}
                onSelect={year => setViewDate(new Date(year, 0, 1))}
                onClose={() => setShowYearPicker(false)}
              />
            )}
            {showYearPicker && (view === 'month' || view === 'week') && (
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
        </div>

        <div className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-slate-200 flex-shrink-0 bg-white/95 backdrop-blur-sm">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            aria-label={prevLabel}
          >
            <AppIcon name="chevron-left" className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            aria-label={nextLabel}
          >
            <AppIcon name="chevron-right" className="h-[18px] w-[18px]" />
          </button>
          <div className="relative flex-1 ml-1">
            <button
              onClick={() => setShowYearPicker(v => !v)}
              className="inline-flex items-center gap-1 text-base font-medium text-slate-800 hover:text-blue-600 cursor-pointer"
            >
              {getNavTitle()}
              <AppIcon name="chevron-down" className="h-3.5 w-3.5 text-slate-400" />
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
          <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
            {VIEW_TAB_VALUES.map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setShowYearPicker(false); }}
                className={`min-w-12 px-2 md:px-3 py-1 text-xs md:text-sm transition-colors ${
                  v === 'year' ? 'hidden md:block' : ''
                } ${
                  view === v
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(v as 'year' | 'month' | 'week' | 'day')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {viewReady && view === 'year' && (
            <YearGrid
              year={viewDate.getFullYear()}
              events={expandedEvents}
              onMonthClick={handleMonthClick}
              onNextYear={goNext}
              onPrevYear={goPrev}
            />
          )}
          {viewReady && view === 'month' && (
            <MonthGrid
              viewDate={viewDate}
              events={expandedEvents}
              onDateClick={handleDayClick}
            />
          )}
          {viewReady && view === 'week' && (
            <WeekView
              startDate={getWeekStart(viewDate)}
              events={expandedEvents}
              focusTime={focusTime}
              onDayClick={handleDayClick}
              onSlotClick={openCreateEditor}
              onEventClick={openEditEditor}
            />
          )}
          {viewReady && view === 'day' && (
            <DayView
              date={viewDate}
              events={expandedEvents}
              focusTime={focusTime}
              onSlotClick={openCreateEditor}
              onEventClick={openEditEditor}
            />
          )}
        </div>
      </main>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label={language === 'zh' ? '关闭菜单' : 'Close menu'}
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[82vw] max-w-xs flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center gap-3 px-5 py-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <AppIcon name="calendar" className="h-5 w-5" />
              </span>
              <span className="text-xl font-medium text-slate-800">CoreShift</span>
            </div>
            <div className="px-3 pb-3">
              {VIEW_TAB_VALUES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setView(v);
                    setShowYearPicker(false);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex h-12 w-full items-center gap-4 rounded-r-full px-4 text-left text-base transition ${
                    view === v ? 'bg-blue-100 text-blue-800 font-medium' : 'text-slate-700 active:bg-slate-100'
                  }`}
                >
                  <AppIcon name={v === 'year' || v === 'month' ? 'calendar' : 'list'} className="h-5 w-5" />
                  <span>{t(v as 'year' | 'month' | 'week' | 'day')}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  goToToday();
                  setMobileMenuOpen(false);
                }}
                className="flex h-11 w-full items-center gap-3 rounded-lg text-left text-slate-700 active:bg-slate-100"
              >
                <AppIcon name="calendar" className="h-5 w-5" />
                <span>{t('today')}</span>
              </button>
            </div>
            <div className="mt-auto border-t border-slate-200 px-4 py-4">
              <SettingsPanel
                googleConnected={googleConnected}
                syncing={syncing}
                syncMsg={syncMsg}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
              />
            </div>
          </aside>
        </div>
      )}

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
          directProcess={voiceDirectProcess}
          autoListen={voiceAutoListen}
          onClose={() => {
            setVoiceOpen(false);
            setVoiceDraft(undefined);
            setVoiceDirectProcess(false);
            setVoiceAutoListen(true);
          }}
        />
      )}

      {isSpaceListening && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 bg-blue-600 text-white text-xs px-4 py-2 rounded-lg shadow-lg animate-pulse pointer-events-none">
          <AppIcon name="mic" className="h-4 w-4" />
          {language === 'zh' ? '正在聆听…松开 Space 完成' : 'Listening… release Space to finish'}
        </div>
      )}

      {voiceShortcutToast && !hasUsedSpaceShortcut && (
        <div className="fixed bottom-20 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg md:bottom-24 md:left-4 md:translate-x-0">
          <AppIcon name="mic" className="h-4 w-4 text-blue-600" />
          <span>{t('voiceShortcutToast')}</span>
        </div>
      )}

      <MobileVoiceFab label={t('voiceInputFab')} onClick={handleVoiceButtonOpen} />

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-fade-in">
          <AppIcon name="check" className="h-4 w-4" />
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
            className="flex items-start gap-3 bg-white border border-blue-200 shadow-lg rounded-lg px-4 py-3 w-72 animate-fade-in"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <AppIcon name="bell" className="h-4 w-4" />
            </span>
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
