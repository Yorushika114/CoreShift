'use client';

import { useState, useEffect, useRef } from 'react';
import { parseVoiceCommandWithLLM } from '@/lib/voice/parseVoiceCommand';
import { useSpeechRecognition } from '@/lib/voice/useSpeechRecognition';
import { formatDate, formatTime, formatTimeCN } from '@/lib/calendar/date-utils';
import { EVENT_COLOR_OPTIONS } from '@/lib/calendar/color-utils';
import { useSettings } from '@/contexts/SettingsContext';
import type { CalendarEvent, ParsedCommand } from '@/types';

interface Props {
  event?: CalendarEvent;
  defaultStartAt?: Date;
  initialText?: string;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted?: (id: string) => void;
}

type Tab = 'quick' | 'manual';

const REMINDER_VALUES = ['', '5', '10', '15', '30', '60', '120', '1440'];

function formatRecurrenceSummary(
  recurrence: 'daily' | 'weekly' | 'monthly',
  endAt?: string | null,
  count?: number | null,
  isZh = true,
): string {
  const freqLabel = isZh
    ? { daily: '每天', weekly: '每周', monthly: '每月' }[recurrence]
    : { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[recurrence];
  if (count) return isZh ? `${freqLabel}，共 ${count} 次` : `${freqLabel}, ${count} times`;
  if (endAt) {
    const d = new Date(endAt);
    return isZh
      ? `${freqLabel}，到 ${d.getMonth() + 1}月${d.getDate()}日`
      : `${freqLabel}, until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return isZh ? `${freqLabel}，无限重复` : `${freqLabel}, indefinitely`;
}

function getReminderOffset(startIso: string, reminderIso: string): string {
  const offsetMin = Math.round(
    (new Date(startIso).getTime() - new Date(reminderIso).getTime()) / 60000,
  );
  return REMINDER_VALUES.find(v => v === String(offsetMin)) ?? String(offsetMin);
}

function toInputDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function EventEditorPanel({
  event,
  defaultStartAt,
  initialText,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const { t, language } = useSettings();
  const nlpLang: 'zh-CN' | 'en-US' = language === 'en' ? 'en-US' : 'zh-CN';
  const REMINDER_OPTIONS = [
    { label: t('noReminder'), value: '' },
    { label: t('reminder5min'), value: '5' },
    { label: t('reminder10min'), value: '10' },
    { label: t('reminder15min'), value: '15' },
    { label: t('reminder30min'), value: '30' },
    { label: t('reminder1h'), value: '60' },
    { label: t('reminder2h'), value: '120' },
    { label: t('reminder1d'), value: '1440' },
  ];
  const isEdit = !!event;
  const [tab, setTab] = useState<Tab>(isEdit ? 'manual' : 'quick');
  const { timezone } = useSettings();

  // quick tab state
  const [nlpInput, setNlpInput] = useState(initialText ?? '');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { supported: micSupported, listening, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      lang: nlpLang,
      onResult: (text) => {
        if (text) setNlpInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      },
    });

  // manual tab state
  const defaultDate = defaultStartAt ?? (event ? new Date(event.startAt) : new Date());
  const defaultEndDate = event?.endAt
    ? new Date(event.endAt)
    : new Date(defaultDate.getTime() + 60 * 60 * 1000);

  const [manualTitle, setManualTitle] = useState(event?.title ?? '');
  const [manualDate, setManualDate] = useState(toInputDate(defaultDate));
  const [manualStart, setManualStart] = useState(toInputTime(defaultDate));
  const [manualEndDate, setManualEndDate] = useState(
    event?.endAt ? toInputDate(event.endAt) : toInputDate(defaultDate),
  );
  const [manualEnd, setManualEnd] = useState(
    event?.endAt ? toInputTime(event.endAt) : toInputTime(defaultEndDate),
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [recurrence, setRecurrence] = useState<'' | 'daily' | 'weekly'>(
    event?.recurrence === 'daily' ? 'daily'
    : event?.recurrence === 'weekly' ? 'weekly'
    : '',
  );
  const [reminderOffset, setReminderOffset] = useState<string>(() => {
    if (event?.reminderAt && event?.startAt)
      return getReminderOffset(event.startAt, event.reminderAt);
    return '';
  });

  const [color, setColor] = useState<string>(event?.color ?? 'blue');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [seriesDeleteMode, setSeriesDeleteMode] = useState<'single' | 'future' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const text = nlpInput.trim();
    if (!text) { setParsed(null); return; }
    let cancelled = false;
    void parseVoiceCommandWithLLM(text, nlpLang, defaultStartAt ?? new Date(), timezone)
      .then(result => { if (!cancelled) setParsed(result); });
    return () => { cancelled = true; };
  }, [defaultStartAt, nlpInput, nlpLang, timezone]);

  // Keep end date in sync when start date changes (only if they were equal)
  function handleManualDateChange(val: string) {
    if (manualEndDate === manualDate) setManualEndDate(val);
    setManualDate(val);
  }

  function handleTabChange(next: Tab) {
    if (next === 'manual' && parsed?.startAt) {
      const s = new Date(parsed.startAt);
      setManualDate(toInputDate(s));
      setManualStart(toInputTime(s));
      if (parsed.endAt) {
        setManualEnd(toInputTime(parsed.endAt));
        setManualEndDate(toInputDate(parsed.endAt));
      }
      if (parsed.title) setManualTitle(parsed.title);
      if (parsed.reminderAt)
        setReminderOffset(getReminderOffset(parsed.startAt, parsed.reminderAt));
    }
    setTab(next);
    setConfirmDelete(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let body: Record<string, unknown>;

      if (tab === 'quick') {
        if (!parsed?.startAt) { setError(t('enterDescription')); setSaving(false); return; }
        body = {
          title: parsed.title || nlpInput.trim(),
          startAt: parsed.startAt,
          endAt: parsed.endAt ?? null,
          reminderAt: parsed.reminderAt ?? null,
          allDay: false,
          recurrence: parsed.recurrence ?? null,
          recurrenceEndAt: parsed.recurrenceEndAt ?? null,
          recurrenceCount: parsed.recurrenceCount ?? null,
          color,
          sourceText: nlpInput.trim(),
        };
      } else {
        if (!manualTitle.trim()) { setError(t('enterTitle')); setSaving(false); return; }
        if (!manualDate) { setError(t('selectDate')); setSaving(false); return; }

        let startIso: string;
        let endIso: string | null;

        if (allDay) {
          startIso = new Date(`${manualDate}T00:00:00`).toISOString();
          endIso = new Date(`${manualEndDate || manualDate}T23:59:59`).toISOString();
        } else {
          if (!manualStart) { setError(t('selectStartTime')); setSaving(false); return; }
          startIso = combineDateTime(manualDate, manualStart);
          endIso = manualEnd ? combineDateTime(manualEndDate || manualDate, manualEnd) : null;

          if (endIso && new Date(endIso) <= new Date(startIso)) {
            setError(t('endBeforeStart'));
            setSaving(false);
            return;
          }
        }

        const computedReminderAt =
          !allDay && reminderOffset
            ? new Date(
                new Date(startIso).getTime() - parseInt(reminderOffset) * 60 * 1000,
              ).toISOString()
            : null;

        body = {
          title: manualTitle.trim(),
          startAt: startIso,
          endAt: endIso,
          reminderAt: computedReminderAt,
          allDay,
          recurrence: recurrence || null,
          color,
        };
      }

      let url: string;
      const method = isEdit ? 'PUT' : 'POST';
      if (isEdit) {
        const recurringMode = (event as CalendarEvent & { _recurringMode?: string })?._recurringMode;
        url = recurringMode
          ? `/api/events/${encodeURIComponent(event!.id)}?mode=${recurringMode}`
          : `/api/events/${encodeURIComponent(event!.id)}`;
      } else {
        url = '/api/events';
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('保存失败');
      const saved: CalendarEvent = await res.json();
      onSaved(saved);
    } catch {
      setError(t('saveFailed'));
      setSaving(false);
    }
  }

  async function handleDelete(mode?: 'future') {
    if (!event) return;
    setDeleting(true);
    setError(null);
    try {
      const url = mode ? `/api/events/${event.id}?mode=future` : `/api/events/${event.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      onDeleted?.(event.id);
    } catch {
      setError(t('deleteFailed'));
      setDeleting(false);
      setConfirmDelete(false);
      setSeriesDeleteMode(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  }

  const quickCanSave = tab === 'quick' && !!parsed?.startAt && !saving;
  const manualCanSave =
    tab === 'manual' &&
    !!manualTitle.trim() &&
    !!manualDate &&
    (allDay || !!manualStart) &&
    !saving;
  const canSave = quickCanSave || manualCanSave;

  const startDate = parsed?.startAt ? new Date(parsed.startAt) : null;
  const endDate = parsed?.endAt ? new Date(parsed.endAt) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            {isEdit ? t('editEvent') : t('newEvent')}
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['quick', 'manual'] as Tab[]).map(tabVal => (
            <button
              key={tabVal}
              onClick={() => handleTabChange(tabVal)}
              className={`flex-1 py-2 text-sm transition-colors ${
                tab === tabVal
                  ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabVal === 'quick' ? t('quickInput') : t('manualInput')}
            </button>
          ))}
        </div>

        {/* Quick tab */}
        {tab === 'quick' && (
          <div className="px-5 pt-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={nlpInput}
                onChange={e => setNlpInput(e.target.value)}
                placeholder={t('nlpPlaceholder')}
                rows={3}
                className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={() => (listening ? stopMic() : startMic())}
                  className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-base transition ${
                    listening
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  aria-label={listening ? t('stop') : t('voiceInput')}
                  title={listening ? t('stop') : t('voiceInput')}
                >
                  🎙
                </button>
              )}
            </div>
            {parsed && nlpInput.trim() && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('systemUnderstanding')}</p>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-10 flex-shrink-0 pt-0.5">{t('titleLabel')}</span>
                  <span className="text-sm text-gray-800 font-medium break-words">
                    {parsed.title || (
                      <span className="text-amber-500 italic">{t('titleNotRecognized')}</span>
                    )}
                  </span>
                </div>
                {startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">{t('timeLabel')}</span>
                    <span className="text-sm text-gray-800">
                      {formatDate(startDate, language)} {formatTime(startDate, language)}
                      {endDate && (
                        <span className="text-gray-500"> — {formatTime(endDate, language)}</span>
                      )}
                    </span>
                  </div>
                )}
                {parsed.reminderAt && startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">{t('reminderLabel')}</span>
                    <span className="text-sm text-gray-800">
                      {formatTimeCN(new Date(parsed.reminderAt))}
                      <span className="text-gray-400 text-xs ml-1">
                        {t('minutesBefore')}{' '}
                        {Math.round(
                          (startDate.getTime() - new Date(parsed.reminderAt).getTime()) / 60000,
                        )}{' '}
                        {t('minuteUnit')}
                      </span>
                    </span>
                  </div>
                )}
                {parsed.recurrence && (
                  <div className="flex items-center gap-1.5 text-sm text-indigo-600 mt-1">
                    <span>↻</span>
                    <span>{formatRecurrenceSummary(
                      parsed.recurrence,
                      parsed.recurrenceEndAt,
                      parsed.recurrenceCount,
                      language === 'zh'
                    )}</span>
                  </div>
                )}
                {parsed.ambiguities.map((msg, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                    <span>⚠</span>{msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual tab */}
        {tab === 'manual' && (
          <div className="px-5 pt-4 space-y-3">
            {/* Title */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('title')}</label>
              <input
                autoFocus
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder={t('eventTitlePlaceholder')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t('color')}</label>
              <div className="flex gap-2">
                {EVENT_COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setColor(opt.id)}
                    className={`w-6 h-6 rounded-full ${opt.bg} flex-shrink-0 transition-transform ${
                      color === opt.id
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* All-day toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm text-gray-700">{t('allDay')}</span>
            </label>

            {/* Start row */}
            <div className={`flex gap-3 ${allDay ? '' : ''}`}>
              <div className={allDay ? 'flex-1' : 'flex-1'}>
                <label className="block text-xs text-gray-500 mb-1">{t('startDate')}</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => handleManualDateChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              {!allDay && (
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">{t('startTime')}</label>
                  <input
                    type="time"
                    value={manualStart}
                    onChange={e => setManualStart(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              )}
            </div>

            {/* End row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{t('endDate')}</label>
                <input
                  type="date"
                  value={manualEndDate}
                  min={manualDate}
                  onChange={e => setManualEndDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              {!allDay && (
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">{t('endTime')}</label>
                  <input
                    type="time"
                    value={manualEnd}
                    onChange={e => setManualEnd(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              )}
            </div>

            {/* Reminder (hidden for all-day) */}
            {!allDay && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('reminder')}</label>
                <select
                  value={reminderOffset}
                  onChange={e => setReminderOffset(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-white"
                >
                  {REMINDER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recurrence */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('repeat')}</label>
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as '' | 'daily' | 'weekly')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-white"
              >
                <option value="">{t('noRepeat')}</option>
                <option value="daily">{t('dailyRepeat')}</option>
                <option value="weekly">{t('weeklyRepeat')}</option>
              </select>
            </div>
          </div>
        )}

        {error && <p className="mx-5 mt-2 text-xs text-red-500">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 mt-3">
          <div>
            {isEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-500 hover:text-red-700 transition"
              >
                {t('delete')}{event?.recurrence ? t('deleteSeriesSuffix') : ''}
              </button>
            )}
            {isEdit && confirmDelete && !seriesDeleteMode && event?.icsSeriesUid && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-500">
                  {language === 'zh' ? '删除循环事件的范围：' : 'Delete recurring event:'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSeriesDeleteMode('single')}
                    className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-full transition"
                  >
                    {language === 'zh' ? '只删这一条' : 'Only this'}
                  </button>
                  <button
                    onClick={() => setSeriesDeleteMode('future')}
                    className="text-xs border border-red-400 text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-full transition"
                  >
                    {language === 'zh' ? '这条及之后所有' : 'This & future'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}
            {isEdit && confirmDelete && (seriesDeleteMode || !event?.icsSeriesUid) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{t('confirmDelete')}</span>
                <button
                  onClick={() => handleDelete(seriesDeleteMode === 'future' ? 'future' : undefined)}
                  disabled={deleting}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full transition disabled:opacity-50"
                >
                  {deleting ? t('deleting') : t('confirm')}
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); setSeriesDeleteMode(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-full transition"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
