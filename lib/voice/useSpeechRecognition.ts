'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicCapture } from './micCapture';

export type SpeechErrorKind =
  | 'unsupported'
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'audio-capture'
  | 'unknown';

export type AsrConnectionState = 'idle' | 'connecting' | 'listening' | 'error';

export interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (text: string) => void;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  interimText: string;
  error: SpeechErrorKind | null;
  connectionState: AsrConnectionState;
  /** 提交本次录音（长按到时/点击麦克风）：开始真正识别。 */
  start: () => void;
  /** 结束录音并等待最终识别结果。 */
  stop: () => void;
  /** 预热：在确认录音意图前就建立讯飞 WS 并开始采集，消除 2.5s 握手延迟。 */
  warmup: () => void;
  /** 取消预热（短按未达成录音意图），丢弃音频，不触发结果。 */
  cancel: () => void;
}

function wsToText(ws: Array<{ cw: Array<{ w: string }> }>): string {
  return ws.map(item => item.cw[0]?.w ?? '').join('');
}

function mapError(code: string): SpeechErrorKind {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed': return 'not-allowed';
    case 'no-speech': return 'no-speech';
    case 'network': return 'network';
    case 'aborted': return 'aborted';
    case 'audio-capture': return 'audio-capture';
    default: return 'unknown';
  }
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognition {
  const { lang = 'zh-CN', onResult } = options;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const langOptionRef = useRef(lang);
  langOptionRef.current = lang;

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<SpeechErrorKind | null>(null);
  const [connectionState, setConnectionState] = useState<AsrConnectionState>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<MicCapture | null>(null);
  const wssAvailableRef = useRef(false);
  const segmentsRef = useRef<Map<number, string>>(new Map());
  const isFirstFrameRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fetchAbortCtrlRef = useRef<AbortController | null>(null);
  const useFallbackRef = useRef(false);

  // 预热相关
  const bufferRef = useRef<ArrayBuffer[]>([]);   // 握手期间缓存的 PCM
  const committedRef = useRef(false);             // 用户是否已确认本次录音（start 调用过）
  const pendingStopRef = useRef(false);           // 握手未完成时用户已松手，onopen 后补发结束帧
  const appIdRef = useRef('');
  const warmingRef = useRef(false);              // fetch URL in-flight，防止预热重入

  useEffect(() => {
    wssAvailableRef.current =
      !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      fetchAbortCtrlRef.current?.abort();
      wsRef.current?.close();
      captureRef.current?.stop();
      recognitionRef.current?.abort();
    };
  }, []);

  function applyResult(result: {
    ws: Array<{ cw: Array<{ w: string }> }>;
    sn: number;
    pgs?: string;
    rg?: [number, number];
  }): string {
    const text = wsToText(result.ws);
    const segs = segmentsRef.current;
    if (result.pgs === 'rpl' && result.rg) {
      for (let i = result.rg[0]; i <= result.rg[1]; i++) segs.delete(i);
    }
    segs.set(result.sn, text);
    return Array.from(segs.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v)
      .join('');
  }

  // 发送结束帧并设置 5s 兜底关闭
  function sendEndFrame(ws: WebSocket) {
    ws.send(JSON.stringify({ data: { status: 2, audio: '' } }));
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      wsRef.current?.close();
      wsRef.current = null;
      closeTimerRef.current = null;
    }, 5000);
  }

  // 预热：keydown 时即建立 WS + 开始采集。握手期间音频缓存，WS open 后补发。
  const warmup = useCallback(() => {
    if (useFallbackRef.current) return;       // 已降级到 Web Speech，不预热
    if (wsRef.current || captureRef.current || warmingRef.current) return; // 已在进行中
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    warmingRef.current = true;

    const currentLang = langOptionRef.current;
    retriedRef.current = false;
    committedRef.current = false;
    pendingStopRef.current = false;
    segmentsRef.current = new Map();
    isFirstFrameRef.current = true;
    bufferRef.current = [];
    setError(null);
    setInterimText('');
    setConnectionState('connecting');
    setListening(true);

    const langParam = currentLang === 'en-US' ? 'en-US' : 'zh-CN';

    // 把一帧 PCM 发往讯飞（首帧带 business 配置）
    const sendFrame = (ws: WebSocket, pcm: ArrayBuffer) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const bytes = new Uint8Array(pcm);
      let binStr = '';
      for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
      const audio = btoa(binStr);
      if (isFirstFrameRef.current) {
        isFirstFrameRef.current = false;
        const xfLang = currentLang === 'en-US' ? 'en_us' : 'zh_cn';
        const biz: Record<string, unknown> = {
          language: xfLang,
          domain: 'iat',
          dwa: 'wpgs',
          vad_eos: 3000,
        };
        if (currentLang !== 'en-US') biz.accent = 'mandarin';
        ws.send(JSON.stringify({
          common: { app_id: appIdRef.current },
          business: biz,
          data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio },
        }));
      } else {
        ws.send(JSON.stringify({ data: { status: 1, audio } }));
      }
    };

    fetchAbortCtrlRef.current?.abort();
    const abortCtrl = new AbortController();
    fetchAbortCtrlRef.current = abortCtrl;

    fetch(`/api/xunfei/asr-url?lang=${langParam}`, { signal: abortCtrl.signal })
      .then(res => {
        if (!res.ok) throw new Error('url fetch failed');
        return res.json() as Promise<{ url: string; appId: string }>;
      })
      .then(({ url, appId }) => {
        fetchAbortCtrlRef.current = null;
        warmingRef.current = false;
        appIdRef.current = appId;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        const capture = new MicCapture();
        captureRef.current = capture;
        capture.start((pcm) => {
          const w = wsRef.current;
          if (w && w.readyState === WebSocket.OPEN) sendFrame(w, pcm);
          else bufferRef.current.push(pcm); // 握手中：缓存待 onopen 补发
        }).catch((err: Error) => {
          const kind: SpeechErrorKind =
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
              ? 'not-allowed'
              : 'audio-capture';
          setError(kind);
          setListening(false);
          setConnectionState('error');
          ws.close();
          wsRef.current = null;
          if (kind === 'not-allowed') setSupported(false);
          if (committedRef.current) onResultRef.current?.('');
        });

        ws.onopen = () => {
          setConnectionState('listening');
          // 补发握手期间缓存的音频
          const buffered = bufferRef.current;
          bufferRef.current = [];
          for (const pcm of buffered) sendFrame(ws, pcm);
          // 若用户在握手期间已松手，补发结束帧拿结果
          if (pendingStopRef.current) {
            pendingStopRef.current = false;
            if (isFirstFrameRef.current) {
              // 握手期间没采到任何音频（说话太短）：直接空结果，走文字兜底
              ws.close();
              wsRef.current = null;
              if (committedRef.current) onResultRef.current?.('');
            } else {
              sendEndFrame(ws);
            }
          }
        };

        ws.onmessage = (event) => {
          if (typeof event.data !== 'string') return;
          try {
            const frame = JSON.parse(event.data) as {
              code: number;
              data?: {
                result?: {
                  ws: Array<{ cw: Array<{ w: string }> }>;
                  sn: number;
                  ls: boolean;
                  pgs?: string;
                  rg?: [number, number];
                };
                status: number;
              };
            };
            if (frame.code !== 0) {
              ws.close();
              onXunfeiFail();
              return;
            }
            if (frame.data?.result) {
              if (!frame.data?.result?.ws) return;
              const full = applyResult(frame.data.result);
              setInterimText(full);
              if (frame.data.result.ls) {
                onResultRef.current?.(full.trim());
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = null;
                }
                ws.close();
                wsRef.current = null;
              }
            }
          } catch {
            // 畸形帧忽略
          }
        };

        ws.onerror = () => {
          setConnectionState('error');
          captureRef.current?.stop();
          captureRef.current = null;
          onXunfeiFail();
        };

        ws.onclose = () => {
          setListening(false);
          setConnectionState(prev => prev === 'listening' ? 'idle' : prev);
        };
      })
      .catch((err: unknown) => {
        warmingRef.current = false;
        // cancel() 中止 fetch：静默丢弃，不触发结果
        if (err instanceof Error && err.name === 'AbortError') return;
        onXunfeiFail();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onXunfeiFail() {
    const currentLang = langOptionRef.current;
    captureRef.current?.stop();
    captureRef.current = null;
    wsRef.current = null;
    if (!retriedRef.current) {
      // 第一次失败：重试一次预热
      retriedRef.current = true;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        warmup();
        if (committedRef.current) committedRef.current = true;
      }, 500);
    } else if (wssAvailableRef.current && committedRef.current) {
      // 二次失败且用户已确认录音：降级到 Web Speech
      useFallbackRef.current = true;
      setConnectionState('idle');
      setError(null);
      startWebSpeech(currentLang);
    } else if (committedRef.current) {
      // 无降级可用：返回空结果，由调用方走文字兜底
      setListening(false);
      setConnectionState('idle');
      onResultRef.current?.('');
    } else {
      setListening(false);
      setConnectionState('idle');
    }
  }

  function startWebSpeech(currentLang: string) {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }

    const recognition = new Ctor();
    recognition.lang = currentLang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText(final);
        onResultRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event) => {
      setError(mapError(event.error));
      if (event.error === 'not-allowed') setSupported(false);
    };

    recognition.onend = () => {
      setListening(false);
      setConnectionState('idle');
    };

    setListening(true);
    setConnectionState('listening');
    try { recognition.start(); } catch { /* already started */ }
  }

  // 确认录音意图（长按到时 / 点击麦克风）
  const start = useCallback(() => {
    if (useFallbackRef.current) {
      committedRef.current = true;
      setError(null);
      setInterimText('');
      startWebSpeech(langOptionRef.current);
      return;
    }
    // 若尚未预热（如点击麦克风直接录音），现在建立连接
    if (!wsRef.current && !captureRef.current && !warmingRef.current) {
      warmup();
    }
    committedRef.current = true;
  }, [warmup]);

  const stop = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    recognitionRef.current?.stop();

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      // 连接就绪：停止采集，发结束帧，等最终识别结果
      captureRef.current?.stop();
      captureRef.current = null;
      sendEndFrame(ws);
    } else if (ws?.readyState === WebSocket.CONNECTING) {
      // 握手未完成：停止采集，但已缓存的音频在 onopen 时补发 + 结束帧
      captureRef.current?.stop();
      captureRef.current = null;
      pendingStopRef.current = true;
    } else {
      captureRef.current?.stop();
      captureRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
    }

    setListening(false);
    setConnectionState('idle');
  }, []);

  // 取消预热（短按）：丢弃音频，不触发结果
  const cancel = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    fetchAbortCtrlRef.current?.abort();
    fetchAbortCtrlRef.current = null;
    captureRef.current?.stop();
    captureRef.current = null;
    recognitionRef.current?.abort();
    // 解绑回调再关闭，避免关闭 CONNECTING 连接触发 onerror → onXunfeiFail 重试
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      ws.close();
    }
    wsRef.current = null;
    bufferRef.current = [];
    warmingRef.current = false;
    committedRef.current = false;
    pendingStopRef.current = false;
    setListening(false);
    setConnectionState('idle');
    setInterimText('');
  }, []);

  return { supported, listening, interimText, error, connectionState, start, stop, warmup, cancel };
}
