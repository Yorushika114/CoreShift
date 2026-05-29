'use client';

import { useEffect, useRef, useState } from 'react';
import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';
import { formatDateCN, formatTimeCN } from '@/lib/calendar/date-utils';
import type { ParsedCommand } from '@/types';

interface Props {
  defaultDate: Date;
  onClose: () => void;
  onSaved: (eventDate: Date) => void;
}

export function AddEventModal({ defaultDate, onClose, onSaved }: Props) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 实时解析
  useEffect(() => {
    if (!input.trim()) { setParsed(null); return; }
    setParsed(parseVoiceCommand(input.trim(), new Date()));
  }, [input]);

  async function handleSave() {
    if (!parsed?.startAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsed.title || input.trim(),
          startAt: parsed.startAt,
          endAt: parsed.endAt ?? null,
          sourceText: input.trim(),
        }),
      });
      if (!res.ok) throw new Error('保存失败');
      onSaved(new Date(parsed.startAt));
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  }

  const startDate = parsed?.startAt ? new Date(parsed.startAt) : null;
  const endDate = parsed?.endAt ? new Date(parsed.endAt) : null;
  const canSave = !!parsed?.startAt && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">新建事件</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Input */}
        <div className="px-5 pt-4">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'用自然语言描述事件\n例：明天下午3点开组会\n     下周一上午9点到10点算法课'}
            rows={3}
            className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        {/* 解析预览 */}
        {parsed && input.trim() && (
          <div className="mx-5 mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
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
                  {endDate && (
                    <span className="text-gray-500"> — {formatTimeCN(endDate)}</span>
                  )}
                </span>
              </div>
            )}

            {parsed.ambiguities.length > 0 && (
              <div className="pt-1 space-y-0.5">
                {parsed.ambiguities.map((msg, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                    <span>⚠</span>{msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mx-5 mt-2 text-xs text-red-500">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 mt-3">
          <span className="text-xs text-gray-400">⌘ Enter 快速保存 · Esc 关闭</span>
          <div className="flex gap-2">
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
