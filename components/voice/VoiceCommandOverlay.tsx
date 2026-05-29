'use client';

import { useEffect, useState } from 'react';
import { useSpeechRecognition, type SpeechErrorKind } from '@/lib/voice/useSpeechRecognition';
import { parseVoiceCommand } from '@/lib/voice/parseVoiceCommand';
import { matchEvents } from '@/lib/voice/matchEvents';
import { applyModify } from '@/lib/voice/applyModify';
import { formatDateCN, formatTimeCN } from '@/lib/calendar/date-utils';
import type { CalendarEvent, ParsedCommand } from '@/types';

interface Props {
  /** create / unknown：把原文交给页面，打开编辑面板预填。 */
  onCreate: (text: string) => void;
  /** modify：传入已 patch 的事件，页面以编辑模式打开供用户确认。 */
  onModify: (event: CalendarEvent) => void;
  /** query：跳转到目标日的日视图。 */
  onQuery: (date: Date) => void;
  /** 删除成功后通知页面刷新。 */
  onChanged: () => void;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<SpeechErrorKind, string> = {
  unsupported: '当前浏览器不支持语音识别',
  'not-allowed': '麦克风权限被拒绝，请改用文字输入',
  'no-speech': '没听清，请再说一次或改用文字',
  network: '网络异常，请重试或改用文字',
  aborted: '识别已取消',
  'audio-capture': '麦克风被占用或设备异常，请检查音频设备',
  unknown: '识别出错，请重试或改用文字',
};

type Result =
  | { kind: 'notfound'; intent: 'delete' | 'modify' }
  | { kind: 'delete'; events: CalendarEvent[] }
  | { kind: 'modify-pick'; events: CalendarEvent[]; pick: (e: CalendarEvent) => void }
  | { kind: 'query'; date: Date; events: CalendarEvent[] }
  | { kind: 'create-preview'; parsed: ParsedCommand; original: string };

function dayRange(d: Date): [Date, Date] {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return [start, end];
}

// 未说日期时的兜底范围：昨天 ~ 60 天后，按标题匹配
function fallbackRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  return [start, end];
}

async function fetchRange([start, end]: [Date, Date]): Promise<CalendarEvent[]> {
  const res = await fetch(
    `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
  );
  if (!res.ok) return [];
  return res.json();
}

export function VoiceCommandOverlay({ onCreate, onModify, onQuery, onChanged, onClose }: Props) {
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { supported, listening, interimText, error, start, stop } = useSpeechRecognition({
    onResult: (text) => { if (text) void handleCommand(text); },
  });

  useEffect(() => {
    if (supported) start();
    else setTextMode(true);
  }, [supported, start]);

  useEffect(() => {
    if (error === 'not-allowed' || error === 'unsupported') setTextMode(true);
  }, [error]);

  async function handleCommand(text: string) {
    setActionError(null);
    const parsed = parseVoiceCommand(text, new Date());

    // create / unknown：若有歧义先展示预览让用户确认，否则直接打开编辑面板
    if (parsed.intent === 'create' || parsed.intent === 'unknown') {
      if (parsed.ambiguities.length > 0) {
        setResult({ kind: 'create-preview', parsed, original: text });
      } else {
        onCreate(text);
      }
      return;
    }

    setBusy(true);
    try {
      const targetDate = parsed.hasDate && parsed.startAt ? new Date(parsed.startAt) : new Date();
      const events = await fetchRange(parsed.hasDate ? dayRange(targetDate) : fallbackRange());

      if (parsed.intent === 'query') {
        onQuery(targetDate);
        setResult({ kind: 'query', date: targetDate, events });
        return;
      }

      const matches = matchEvents(events, {
        date: targetDate,
        hasDate: parsed.hasDate,
        title: parsed.title,
      });

      if (matches.length === 0) {
        setResult({ kind: 'notfound', intent: parsed.intent });
        return;
      }

      if (parsed.intent === 'modify') {
        if (matches.length === 1) {
          onModify(applyModify(matches[0], parsed));
          return;
        }
        setResult({
          kind: 'modify-pick',
          events: matches,
          pick: (e) => onModify(applyModify(e, parsed)),
        });
        return;
      }

      // delete
      setResult({ kind: 'delete', events: matches });
    } catch {
      setActionError('处理失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    stop();
    onClose();
  }

  function submitText() {
    const t = textInput.trim();
    if (t) void handleCommand(t);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onChanged();
      onClose();
    } catch {
      setActionError('删除失败，请重试');
      setDeletingId(null);
    }
  }

  function eventRow(e: CalendarEvent) {
    const d = new Date(e.startAt);
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-800 font-medium flex-1 break-words">{e.title}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatDateCN(d)} {formatTimeCN(d)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">🎙 语音输入</span>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* 处理结果区 */}
        {result ? (
          <div className="px-5 py-5 space-y-3">
            {result.kind === 'notfound' && (
              <p className="text-sm text-gray-600">
                未找到匹配的事件，换个说法或改用{result.intent === 'delete' ? '手动删除' : '手动编辑'}试试。
              </p>
            )}

            {result.kind === 'delete' && (
              <>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">确认删除</p>
                <div className="space-y-2">
                  {result.events.map((e) => (
                    <div key={e.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">{eventRow(e)}</div>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deletingId === e.id}
                        className="text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full transition disabled:opacity-50 flex-shrink-0"
                      >
                        {deletingId === e.id ? '删除中…' : '删除'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {result.kind === 'modify-pick' && (
              <>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">选择要修改的事件</p>
                <div className="space-y-2">
                  {result.events.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => result.pick(e)}
                      className="w-full text-left rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-300 px-4 py-3 transition"
                    >
                      {eventRow(e)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {result.kind === 'query' && (
              <>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {formatDateCN(result.date)} 的安排（{result.events.length}）
                </p>
                {result.events.length === 0 ? (
                  <p className="text-sm text-gray-500">这天没有安排。</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.events.map((e) => (
                      <div key={e.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                        {eventRow(e)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {result.kind === 'create-preview' && (
              <>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">识别结果</p>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">标题</span>
                    <span className="text-sm text-gray-800 font-medium">
                      {result.parsed.title ?? <span className="text-amber-500 italic">（未识别）</span>}
                    </span>
                  </div>
                  {result.parsed.startAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-10 flex-shrink-0">时间</span>
                      <span className="text-sm text-gray-800">
                        {formatDateCN(new Date(result.parsed.startAt))} {formatTimeCN(new Date(result.parsed.startAt))}
                      </span>
                    </div>
                  )}
                  {result.parsed.ambiguities.map((msg, i) => (
                    <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                      <span>⚠</span>{msg}
                    </p>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setResult(null)}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-full transition"
                  >
                    重新输入
                  </button>
                  <button
                    onClick={() => onCreate(result.original)}
                    className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                  >
                    填写详情
                  </button>
                </div>
              </>
            )}

            {actionError && <p className="text-xs text-red-500">{actionError}</p>}

            {result.kind !== 'create-preview' && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleClose}
                  className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-full transition"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        ) : busy ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3">
            <span className="text-2xl animate-pulse">⏳</span>
            <p className="text-sm text-gray-500">处理中…</p>
          </div>
        ) : !textMode ? (
          <div className="px-5 py-8 flex flex-col items-center gap-5">
            <button
              onClick={listening ? stop : start}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition ${
                listening
                  ? 'bg-blue-500 text-white animate-pulse shadow-lg shadow-blue-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              aria-label={listening ? '停止' : '开始说话'}
            >
              🎙
            </button>

            <p className="text-sm text-gray-500 min-h-[1.25rem]">
              {listening ? '正在聆听，说完会自动停止…' : '点击麦克风开始说话'}
            </p>

            {interimText && (
              <p className="text-base text-gray-800 text-center break-words px-2">{interimText}</p>
            )}

            {error && error !== 'not-allowed' && error !== 'unsupported' && (
              <p className="text-xs text-amber-600">{ERROR_MESSAGES[error]}</p>
            )}

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              试试：明天下午3点开组会 · 删除明天的组会 · 明天有什么安排
            </p>

            <button
              onClick={() => { stop(); setTextMode(true); }}
              className="text-xs text-blue-500 hover:text-blue-700 transition"
            >
              改用文字输入
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 flex flex-col gap-3">
            {error && <p className="text-xs text-amber-600">{ERROR_MESSAGES[error]}</p>}
            <textarea
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitText();
              }}
              placeholder={'用自然语言描述\n例：明天下午3点开组会 / 删除明天的组会'}
              rows={3}
              className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <div className="flex items-center justify-between">
              {supported ? (
                <button
                  onClick={() => { setTextMode(false); start(); }}
                  className="text-xs text-blue-500 hover:text-blue-700 transition"
                >
                  ← 改用语音
                </button>
              ) : <span />}
              <button
                onClick={submitText}
                disabled={!textInput.trim()}
                className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
