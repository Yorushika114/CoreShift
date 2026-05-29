'use client';

import { useState, useEffect, useRef } from 'react';
import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';
import { formatDateCN, formatTimeCN } from '@/lib/calendar/date-utils';
import type { CalendarEvent, ParsedCommand } from '@/types';

interface Props {
  event?: CalendarEvent;       // provided → edit mode
  defaultStartAt?: Date;       // pre-fill time when creating from slot click
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted?: (id: string) => void;
}

type Tab = 'quick' | 'manual';

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
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!event;
  const [tab, setTab] = useState<Tab>(isEdit ? 'manual' : 'quick');

  // quick tab state
  const [nlpInput, setNlpInput] = useState('');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // manual tab state
  const defaultDate = defaultStartAt ?? (event ? new Date(event.startAt) : new Date());
  const defaultEndDate = event?.endAt
    ? new Date(event.endAt)
    : new Date(defaultDate.getTime() + 60 * 60 * 1000);

  const [manualTitle, setManualTitle] = useState(event?.title ?? '');
  const [manualDate, setManualDate] = useState(toInputDate(defaultDate));
  const [manualStart, setManualStart] = useState(toInputTime(defaultDate));
  const [manualEnd, setManualEnd] = useState(event?.endAt ? toInputTime(event.endAt) : toInputTime(defaultEndDate));
  const [manualReminder, setManualReminder] = useState(event?.reminderAt ? toInputTime(event.reminderAt) : '');

  // save / delete state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // NLP parse on input change
  useEffect(() => {
    if (!nlpInput.trim()) { setParsed(null); return; }
    setParsed(parseVoiceCommand(nlpInput.trim(), new Date()));
  }, [nlpInput]);

  // When switching to manual tab, pre-fill from parsed if available
  function handleTabChange(next: Tab) {
    if (next === 'manual' && parsed?.startAt) {
      const s = new Date(parsed.startAt);
      setManualDate(toInputDate(s));
      setManualStart(toInputTime(s));
      if (parsed.endAt) setManualEnd(toInputTime(parsed.endAt));
      if (parsed.title) setManualTitle(parsed.title);
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
          sourceText: nlpInput.trim(),
        };
      } else {
        if (!manualTitle.trim()) { setError('请输入事件标题'); setSaving(false); return; }
        if (!manualDate || !manualStart) { setError('请选择日期和开始时间'); setSaving(false); return; }
        body = {
          title: manualTitle.trim(),
          startAt: combineDateTime(manualDate, manualStart),
          endAt: manualEnd ? combineDateTime(manualDate, manualEnd) : null,
          reminderAt: manualReminder ? combineDateTime(manualDate, manualReminder) : null,
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
  const manualCanSave = tab === 'manual' && !!manualTitle.trim() && !!manualDate && !!manualStart && !saving;
  const canSave = quickCanSave || manualCanSave;

  const startDate = parsed?.startAt ? new Date(parsed.startAt) : null;
  const endDate = parsed?.endAt ? new Date(parsed.endAt) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onKeyDown={handleKeyDown}>
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
            <textarea
              ref={inputRef}
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              placeholder={'用自然语言描述事件\n例：明天下午3点开组会\n     下周一上午9点到10点算法课'}
              rows={3}
              className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            {parsed && nlpInput.trim() && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">系统理解</p>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-10 flex-shrink-0 pt-0.5">标题</span>
                  <span className="text-sm text-gray-800 font-medium break-words">
                    {parsed.title || <span className="text-amber-500 italic">（未识别，将使用原文）</span>}
                  </span>
                </div>
                {startDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">时间</span>
                    <span className="text-sm text-gray-800">
                      {formatDateCN(startDate)} {formatTimeCN(startDate)}
                      {endDate && <span className="text-gray-500"> — {formatTimeCN(endDate)}</span>}
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">日期</label>
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">开始时间</label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={e => setManualStart(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">结束时间（可选）</label>
                <input
                  type="time"
                  value={manualEnd}
                  onChange={e => setManualEnd(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">提醒时间（可选）</label>
              <input
                type="time"
                value={manualReminder}
                onChange={e => setManualReminder(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mx-5 mt-2 text-xs text-red-500">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 mt-3">
          {/* Left: delete (edit mode) */}
          <div>
            {isEdit && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-500 hover:text-red-700 transition"
              >
                删除
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

          {/* Right: cancel + save */}
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
