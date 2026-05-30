'use client';

import { useEffect, useRef, useState } from 'react';
import { useSpeechRecognition, type SpeechErrorKind } from '@/lib/voice/useSpeechRecognition';
import { useTTS } from '@/lib/voice/useTTS';
import { parseVoiceCommandWithLLM } from '@/lib/voice/parseVoiceCommand';
import { matchEvents } from '@/lib/voice/matchEvents';
import { applyModify } from '@/lib/voice/applyModify';
import { formatDateCN, formatTimeCN } from '@/lib/calendar/date-utils';
import { useSettings } from '@/contexts/SettingsContext';
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


type Result =
  | { kind: 'notfound'; intent: 'delete' | 'modify' }
  | { kind: 'delete'; events: CalendarEvent[]; approximate?: boolean }
  | { kind: 'modify-pick'; events: CalendarEvent[]; pick: (e: CalendarEvent) => void; approximate?: boolean }
  | { kind: 'query'; date: Date; events: CalendarEvent[]; aiSummary?: string }
  | { kind: 'summarize'; summary: string; events: CalendarEvent[]; rangeLabel: string }
  | { kind: 'create-preview'; parsed: ParsedCommand; original: string };

function dayRange(d: Date): [Date, Date] {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return [start, end];
}

// 删除/修改的候选抓取范围：过去 30 天 ~ 未来 90 天。
// 宽窗口拉全，日期匹配交给 matchEvents 排序/分层，避免"事件不在我说的那天"导致找不到。
function wideRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
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
  const { t, language, timezone } = useSettings();
  const ERROR_MESSAGES: Record<SpeechErrorKind, string> = {
    unsupported: language === 'zh' ? '当前浏览器不支持语音识别' : 'Voice recognition not supported in this browser',
    'not-allowed': language === 'zh' ? '麦克风权限被拒绝，请改用文字输入' : 'Microphone access denied, please use text input',
    'no-speech': language === 'zh' ? '没听清，请再说一次或改用文字' : 'Nothing detected, please try again or use text',
    network: language === 'zh' ? '网络异常，请重试或改用文字' : 'Network error, please retry or use text',
    aborted: language === 'zh' ? '识别已取消' : 'Recognition cancelled',
    'audio-capture': language === 'zh' ? '麦克风被占用或设备异常，请检查音频设备' : 'Microphone unavailable, please check audio devices',
    unknown: language === 'zh' ? '识别出错，请重试或改用文字' : 'Recognition error, please retry or use text',
  };
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lang, setLang] = useState<'zh-CN' | 'en-US'>(language === 'en' ? 'en-US' : 'zh-CN');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [summaryListOpen, setSummaryListOpen] = useState(false);
  const { supported, listening, interimText, error, start, stop } = useSpeechRecognition({
    lang,
    onResult: (text) => { if (text) void handleCommand(text); },
  });
  const { speak } = useTTS();

  useEffect(() => {
    if (supported) start();
    else setTextMode(true);
  }, [supported, start]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error === 'not-allowed' || error === 'unsupported') setTextMode(true);
  }, [error]);

  async function handleCommand(text: string) {
    setActionError(null);
    setResult(null);
    if (/^退出$|^关闭$|^取消$|^exit$|^close$|^cancel$/i.test(text.trim())) {
      handleClose();
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseVoiceCommandWithLLM(text, lang, new Date(), timezone);

      if (parsed.intent === 'create' || parsed.intent === 'unknown') {
        if (parsed.ambiguities.length > 0) {
          setResult({ kind: 'create-preview', parsed, original: text });
        } else {
          onCreate(text);
        }
        return;
      }

      const targetDate = parsed.hasDate && parsed.startAt ? new Date(parsed.startAt) : new Date();

      if (parsed.intent === 'query') {
        const fetchStart = parsed.queryRangeStart
          ? new Date(parsed.queryRangeStart)
          : dayRange(targetDate)[0];
        const fetchEnd = parsed.queryRangeEnd
          ? new Date(parsed.queryRangeEnd)
          : dayRange(targetDate)[1];

        const events = await fetchRange([fetchStart, fetchEnd]);
        onQuery(targetDate);

        let aiSummary: string | undefined;
        try {
          const summaryRes = await fetch('/api/llm/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: text,
              events,
              lang,
              rangeStart: fetchStart.toISOString(),
              rangeEnd: fetchEnd.toISOString(),
            }),
          });
          if (summaryRes.ok) {
            const { summary } = await summaryRes.json() as { summary: string };
            aiSummary = summary;
          }
        } catch {}

        setResult({ kind: 'query', date: targetDate, events, aiSummary });
        speak(aiSummary ?? (
          events.length === 0
            ? (lang === 'en-US' ? 'No events found' : `${formatDateCN(targetDate)}没有安排`)
            : (lang === 'en-US'
                ? `Found ${events.length} event${events.length > 1 ? 's' : ''}`
                : `${formatDateCN(targetDate)}有${events.length}个安排`)
        ));
        return;
      }

      if (parsed.intent === 'summarize') {
        const fetchStart = parsed.queryRangeStart
          ? new Date(parsed.queryRangeStart)
          : dayRange(new Date())[0];
        const fetchEnd = parsed.queryRangeEnd
          ? new Date(parsed.queryRangeEnd)
          : dayRange(new Date())[1];

        setSummaryListOpen(false);
        const events = await fetchRange([fetchStart, fetchEnd]);
        const summaryRes = await fetch('/api/llm/schedule-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events,
            lang,
            rangeStart: fetchStart.toISOString(),
            rangeEnd: fetchEnd.toISOString(),
            tz: timezone,
          }),
        });
        const { summary } = summaryRes.ok
          ? (await summaryRes.json() as { summary: string })
          : { summary: lang === 'en-US' ? 'Could not generate summary.' : '摘要生成失败。' };

        const rangeLabel = parsed.queryRangeStart
          ? new Date(parsed.queryRangeStart).toLocaleDateString(lang === 'en-US' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' })
          : '';
        setResult({ kind: 'summarize', summary, events, rangeLabel });
        if (ttsEnabled) speak(summary);
        return;
      }

      const events = await fetchRange(wideRange());
      const { results, tier } = matchEvents(events, {
        date: targetDate,
        hasDate: parsed.hasDate,
        title: parsed.title,
      });

      if (results.length === 0) {
        setResult({ kind: 'notfound', intent: parsed.intent as 'delete' | 'modify' });
        speak(t('noPeriodSchedule'));
        return;
      }

      const approximate = tier !== 'exact';

      if (parsed.intent === 'modify') {
        if (tier === 'exact' && results.length === 1) {
          onModify(applyModify(results[0], parsed));
          return;
        }
        setResult({
          kind: 'modify-pick',
          events: results,
          approximate,
          pick: (e) => onModify(applyModify(e, parsed)),
        });
        return;
      }

      setResult({ kind: 'delete', events: results, approximate });
    } catch {
      setActionError(lang === 'en-US' ? 'Processing failed, please try again' : '处理失败，请重试');
      speak(lang === 'en-US' ? 'Processing failed, please try again' : '处理失败，请重试');
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
      speak(language === 'zh' ? '已成功删除' : 'Successfully deleted');
      onChanged();
      onClose();
    } catch {
      setActionError(language === 'zh' ? '删除失败，请重试' : 'Delete failed, please retry');
      setDeletingId(null);
    }
  }

  async function handleSummary(range: 'today' | 'week') {
    setActionError(null);
    setResult(null);
    setSummaryListOpen(false);
    setBusy(true);

    const now = new Date();
    let fetchStart: Date;
    let fetchEnd: Date;
    let rangeLabel: string;

    if (range === 'today') {
      [fetchStart, fetchEnd] = dayRange(now);
      rangeLabel = lang === 'en-US' ? 'Today' : '今天';
    } else {
      const day = now.getDay(); // 0=Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      fetchStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
      fetchEnd = new Date(fetchStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      rangeLabel = lang === 'en-US' ? 'This Week' : '本周';
    }

    try {
      const events = await fetchRange([fetchStart, fetchEnd]);
      const summaryRes = await fetch('/api/llm/schedule-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          lang,
          rangeStart: fetchStart.toISOString(),
          rangeEnd: fetchEnd.toISOString(),
          tz: timezone,
        }),
      });
      const { summary } = summaryRes.ok
        ? (await summaryRes.json() as { summary: string })
        : { summary: lang === 'en-US' ? 'Could not generate summary.' : '摘要生成失败。' };

      setResult({ kind: 'summarize', summary, events, rangeLabel });
      if (ttsEnabled) speak(summary);
    } catch {
      setActionError(lang === 'en-US' ? 'Summary failed, please retry' : '摘要生成失败，请重试');
    } finally {
      setBusy(false);
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
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">🎙 {t('voiceInput')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(l => l === 'zh-CN' ? 'en-US' : 'zh-CN')}
              className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition"
            >
              {lang === 'zh-CN' ? '中' : 'EN'}
            </button>
            <button
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* 处理结果区 */}
        {result ? (
          <div className="px-5 py-5 space-y-3">
            {result.kind === 'notfound' && (
              <p className="text-sm text-gray-600">
                {result.intent === 'delete' ? t('notFoundDelete') : t('notFoundModify')}
              </p>
            )}

            {result.kind === 'delete' && (
              <>
                {result.approximate && (
                  <p className="text-xs text-amber-600">{t('noExactMatchDelete')}</p>
                )}
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('confirmDeleteTitle')}</p>
                <div className="space-y-2">
                  {result.events.map((e) => (
                    <div key={e.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">{eventRow(e)}</div>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deletingId === e.id}
                        className="text-sm text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full transition disabled:opacity-50 flex-shrink-0"
                      >
                        {deletingId === e.id ? t('deleting') : t('delete')}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {result.kind === 'modify-pick' && (
              <>
                {result.approximate && (
                  <p className="text-xs text-amber-600">{t('noExactMatchModify')}</p>
                )}
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('selectToModify')}</p>
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
                {result.aiSummary && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                    <p className="text-xs text-blue-400 font-medium mb-1">AI 摘要</p>
                    <p className="text-sm text-blue-800 leading-relaxed">{result.aiSummary}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {lang === 'zh-CN'
                    ? `${formatDateCN(result.date)} 的安排（${result.events.length}）`
                    : `Events on ${result.date.toLocaleDateString('en-US')} (${result.events.length})`}
                </p>
                {result.events.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('noDaySchedule')}</p>
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

            {result.kind === 'summarize' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-blue-400 font-medium">
                    {result.rangeLabel
                      ? (lang === 'en-US' ? `AI Summary · ${result.rangeLabel}` : `AI 摘要 · ${result.rangeLabel}`)
                      : (lang === 'en-US' ? 'AI Summary' : 'AI 摘要')}
                  </p>
                  <button
                    onClick={() => setTtsEnabled(v => !v)}
                    aria-pressed={ttsEnabled}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      ttsEnabled
                        ? 'border-blue-300 text-blue-500 bg-blue-50'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-100'
                    }`}
                    title={ttsEnabled
                      ? (lang === 'en-US' ? 'Mute TTS' : '关闭朗读')
                      : (lang === 'en-US' ? 'Enable TTS' : '开启朗读')}
                  >
                    {ttsEnabled ? '🔊' : '🔇'}
                  </button>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-sm text-blue-800 leading-relaxed">{result.summary}</p>
                </div>
                {result.events.length > 0 && (
                  <div>
                    <button
                      onClick={() => setSummaryListOpen(v => !v)}
                      aria-expanded={summaryListOpen}
                      className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1 mt-2"
                    >
                      <span>{summaryListOpen ? '▾' : '▸'}</span>
                      {summaryListOpen
                        ? (lang === 'en-US' ? 'Collapse' : '收起')
                        : (lang === 'en-US'
                            ? `Show ${result.events.length} event${result.events.length > 1 ? 's' : ''}`
                            : `展开 ${result.events.length} 个安排`)}
                    </button>
                    {summaryListOpen && (
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {result.events.map((e) => (
                          <div key={e.id} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                            {eventRow(e)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {result.kind === 'create-preview' && (
              <>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t('recognitionResult')}</p>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0">{t('titleLabel')}</span>
                    <span className="text-sm text-gray-800 font-medium">
                      {result.parsed.title ?? (
                        <span className="text-amber-500 italic">
                          {lang === 'zh-CN' ? '（未识别）' : '(not recognized)'}
                        </span>
                      )}
                    </span>
                  </div>
                  {result.parsed.startAt && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-10 flex-shrink-0">{t('timeLabel')}</span>
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
                    {t('reenter')}
                  </button>
                  <button
                    onClick={() => onCreate(result.original)}
                    className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                  >
                    {t('fillDetails')}
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
                  {t('close')}
                </button>
              </div>
            )}
          </div>
        ) : busy ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3">
            <span className="text-2xl animate-pulse">⏳</span>
            <p className="text-sm text-gray-500">{t('processing')}</p>
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
              aria-label={listening ? t('stop') : t('startSpeaking')}
            >
              🎙
            </button>

            <p className="text-sm text-gray-500 min-h-[1.25rem]">
              {listening ? t('listeningActive') : t('listeningIdle')}
            </p>

            {interimText && (
              <p className="text-base text-gray-800 text-center break-words px-2">{interimText}</p>
            )}

            {error && error !== 'not-allowed' && error !== 'unsupported' && (
              <p className="text-xs text-amber-600">{ERROR_MESSAGES[error]}</p>
            )}

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              {t('voiceExamples')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => { stop(); void handleSummary('today'); }}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 Today' : '📋 今天'}
              </button>
              <button
                onClick={() => { stop(); void handleSummary('week'); }}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 This Week' : '📋 本周'}
              </button>
            </div>

            <button
              onClick={() => { stop(); setTextMode(true); }}
              className="text-xs text-blue-500 hover:text-blue-700 transition"
            >
              {t('switchToText')}
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
              placeholder={t('textInputPlaceholder')}
              rows={3}
              className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <div className="flex items-center justify-between">
              {supported ? (
                <button
                  onClick={() => { setTextMode(false); start(); }}
                  className="text-xs text-blue-500 hover:text-blue-700 transition"
                >
                  {t('switchToVoice')}
                </button>
              ) : <span />}
              <button
                onClick={submitText}
                disabled={!textInput.trim()}
                className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {t('ok')}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void handleSummary('today')}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 Today' : '📋 今天'}
              </button>
              <button
                onClick={() => void handleSummary('week')}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
              >
                {lang === 'en-US' ? '📋 This Week' : '📋 本周'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
