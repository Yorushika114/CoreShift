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
  start: () => void;
  stop: () => void;
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

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<SpeechErrorKind | null>(null);
  const [connectionState, setConnectionState] = useState<AsrConnectionState>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<MicCapture | null>(null);
  const segmentsRef = useRef<Map<number, string>>(new Map());
  const isFirstFrameRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const useFallbackRef = useRef(false);

  const wssAvailable =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
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

  const startXunfei = useCallback((currentLang: string) => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retriedRef.current = false;
    segmentsRef.current = new Map();
    isFirstFrameRef.current = true;
    setError(null);
    setInterimText('');
    setConnectionState('connecting');
    setListening(true);

    const langParam = currentLang === 'en-US' ? 'en-US' : 'zh-CN';

    fetch(`/api/xunfei/asr-url?lang=${langParam}`)
      .then(res => {
        if (!res.ok) throw new Error('url fetch failed');
        return res.json() as Promise<{ url: string; appId: string }>;
      })
      .then(({ url, appId }) => {
        wsRef.current?.close();
        const ws = new WebSocket(url);
        wsRef.current = ws;

        const capture = new MicCapture();
        captureRef.current = capture;

        ws.onopen = () => {
          setConnectionState('listening');
          capture.start((pcm) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const bytes = new Uint8Array(pcm);
            const binStr = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
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
                common: { app_id: appId },
                business: biz,
                data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio },
              }));
            } else {
              ws.send(JSON.stringify({ data: { status: 1, audio } }));
            }
          }).catch((err: Error) => {
            const kind: SpeechErrorKind =
              (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
                ? 'not-allowed'
                : 'audio-capture';
            setError(kind);
            setListening(false);
            setConnectionState('error');
            ws.close();
            if (kind === 'not-allowed') setSupported(false);
          });
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
              onXunfeiFail(currentLang);
              return;
            }
            if (frame.data?.result) {
              const full = applyResult(frame.data.result);
              setInterimText(full);
              if (frame.data.status === 2) {
                onResultRef.current?.(full.trim());
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
          onXunfeiFail(currentLang);
        };

        ws.onclose = () => {
          setListening(false);
          setConnectionState(prev => prev === 'listening' ? 'idle' : prev);
        };
      })
      .catch(() => onXunfeiFail(currentLang));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onXunfeiFail(currentLang: string) {
    captureRef.current?.stop();
    captureRef.current = null;
    if (!retriedRef.current) {
      retriedRef.current = true;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        startXunfei(currentLang);
      }, 500);
    } else if (wssAvailable) {
      useFallbackRef.current = true;
      setConnectionState('idle');
      setError(null);
      startWebSpeech(currentLang);
    } else {
      setSupported(false);
      setListening(false);
      setConnectionState('idle');
      setError('network');
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

  const start = useCallback(() => {
    if (useFallbackRef.current) {
      setError(null);
      setInterimText('');
      startWebSpeech(lang);
    } else {
      startXunfei(lang);
    }
  }, [lang, startXunfei]);

  const stop = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ data: { status: 2, audio: '' } }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    captureRef.current?.stop();
    captureRef.current = null;
    recognitionRef.current?.stop();
    setListening(false);
    setConnectionState('idle');
  }, []);

  return { supported, listening, interimText, error, connectionState, start, stop };
}
