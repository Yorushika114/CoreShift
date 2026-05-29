'use client';

import { useState, useEffect, useRef } from 'react';
import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';
import { useSpeechRecognition } from '@/lib/voice/useSpeechRecognition';
import { formatDateCN, formatTimeCN } from '@/lib/calendar/date-utils';
import { EVENT_COLOR_OPTIONS } from '@/lib/calendar/color-utils';
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

const REMINDER_OPTIONS = [
  { label: '不提醒', value: '' },
  { label: '提前 5 分钟', value: '5' },
  { label: '提前 10 分钟', value: '10' },
  { label: '提前 15 分钟', value: '15' },
  { label: '提前 30 分钟', value: '30' },
  { label: '提前 1 小时', value: '60' },
  { label: '提前 2 小时', value: '120' },
  { label: '提前 1 天', value: '1440' },
];

function getReminderOffset(startIso: string, reminderIso: string): string {
  const offsetMin = Math.round(
    (new Date(startIso).getTime() - new Date(reminderIso).getTime()) / 60000,
  );
  const match = REMINDER_OPTIONS.find(o => o.value === String(offsetMin));
  return match ? match.value : String(offsetMin);
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
  const isEdit = !!event;
  const [tab, setTab] = useState<Tab>(isEdit ? 'manual' : 'quick');

  // quick tab state
  const [nlpInput, setNlpInput] = useState(initialText ?? '');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { supported: micSupported, listening, start: startMic, stop: stopMic } =
    useSpeechRecognition({
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!nlpInput.trim()) { setParsed(null); return; }
    setParsed(parseVoiceCommand(nlpInput.trim(), new Date()));
  }, [nlpInput]);

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
        if (!parsed?.startAt) { setError('请先输入事件描述'); setSaving(false); return; }
        body = {
          title: parsed.title || nlpInput.trim(),
          startAt: parsed.startAt,
          endAt: parsed.endAt ?? null,
          reminderAt: parsed.reminderAt ?? null,
          allDay: false,
          recurrence: null,
          color,
          sourceText: nlpInput.trim(),
        };
      } else {
        if (!manualTitle.trim()) { setError('请输入事件标题'); setSaving(false); return; }
        if (!manualDate) { setError('请选择日期'); setSaving(false); return; }

        let startIso: string;
        let endIso: string | null;

        if (allDay) {
          startIso = new Date(`${manualDate}T00:00:00`).toISOString();
          endIso = new Date(`${manualEndDate || manualDate}T23:59:59`).toISOString();
        } else {
          if (!manualStart) { setError('请选择开始时间'); setSaving(false); return; }
          startIso = combineDateTime(manualDate, manualStart);
          endIso = manualEnd ? combineDateTime(manualEndDate || manualDate, manualEnd) : null;

          if (endIso && new Date(endIso) <= new Date(startIso)) {
            setError('结束时间必须晚于开始时间');
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

      const url = isEdit ? `/api/events/${event!.id}` : '/api/events';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('保存失败');
      const saved: CalendarEvent = await res.json();
      onSaved(saved);
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      onDeleted?.(event.id);
    } catch {
      setError('删除失败，请重试');
      setDeleting(false);
      setConfirmDelete(false);
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
            {isEdit ? '编辑事件' : '新建事件'}
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
          {(['quick', 'manual'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 py-2 text-sm transition-colors ${
                tab === t
                  ? 'text-blue-600 border-b-2 border-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'quick' ? '快速输入' : '手动填写'}
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
                placeholder={'用自然语言描述事件\n例：明天下午3点开组会\n     下周一上午9点到10点算法课'}
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
                  aria-label={listening ? '停止语音输入' : '语音输入'}
                  title={listening ? '停止语音输入' : '语音输入'}
                >
                  🎙
                </button>
              )}
            </div>
            {parsed && nlpInput.trim() && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">系统理解</p>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-10 flex-shrink-0 pt-0.5">标题</span>
                  <span className="text-sm text-gray-800 font-medium break-words">
                    {parsed.title || (
                      <span className="text-amber-500 italic">（未识别，将使用原文）</span>
                    )}
                  </span>
                </div>
                {startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">时间</span>
                    <span className="text-sm text-gray-800">
                      {formatDateCN(startDate)} {formatTimeCN(startDate)}
                      {endDate && (
                        <span className="text-gray-500"> — {formatTimeCN(endDate)}</span>
                      )}
                    </span>
                  </div>
                )}
                {parsed.reminderAt && startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">提醒</span>
                    <span className="text-sm text-gray-800">
                      {formatTimeCN(new Date(parsed.reminderAt))}
                      <span className="text-gray-400 text-xs ml-1">
                        （提前{' '}
                        {Math.round(
                          (startDate.getTime() - new Date(parsed.reminderAt).getTime()) / 60000,
                        )}{' '}
                        分钟）
                      </span>
                    </span>
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
              <label className="block text-xs text-gray-500 mb-1">标题</label>
              <input
                autoFocus
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="事件标题"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">颜色</label>
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
              <span className="text-sm text-gray-700">全天事件</span>
            </label>

            {/* Start row */}
            <div className={`flex gap-3 ${allDay ? '' : ''}`}>
              <div className={allDay ? 'flex-1' : 'flex-1'}>
                <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => handleManualDateChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              {!allDay && (
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">开始时间</label>
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
                <label className="block text-xs text-gray-500 mb-1">结束日期</label>
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
                  <label className="block text-xs text-gray-500 mb-1">结束时间（可选）</label>
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
                <label className="block text-xs text-gray-500 mb-1">提醒</label>
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
              <label className="block text-xs text-gray-500 mb-1">重复</label>
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as '' | 'daily' | 'weekly')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-white"
              >
                <option value="">不重复</option>
                <option value="daily">每日重复</option>
                <option value="weekly">每周重复</option>
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
                删除{event?.recurrence ? '（整个系列）' : ''}
              </button>
            )}
            {isEdit && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">确认删除？</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full transition disabled:opacity-50"
                >
                  {deleting ? '删除中…' : '确认'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  取消
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {tab === 'quick' && (
              <span className="text-xs text-gray-400 mr-1">⌘↵ 快速保存</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-full transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
