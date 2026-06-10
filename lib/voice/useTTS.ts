'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PcmStreamPlayer } from './pcmPlayer';

export type TtsConnectionState = 'idle' | 'connecting' | 'speaking' | 'error';

export interface UseTTSResult {
  speak: (text: string) => void;
  speaking: boolean;
  connectionState: TtsConnectionState;
}

export function useTTS(): UseTTSResult {
  const [connectionState, setConnectionState] = useState<TtsConnectionState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const playerRef = useRef<PcmStreamPlayer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      playerRef.current?.close();
    };
  }, []);

  const speakLocal = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    }, 50);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      speakLocal(text);
      return;
    }

    let retried = false;

    function tryXunfei() {
      setConnectionState('connecting');
      setSpeaking(true);

      fetch('/api/xunfei/tts-url')
        .then(res => {
          if (!res.ok) throw new Error('url fetch failed');
          return res.json() as Promise<{ url: string; appId: string }>;
        })
        .then(({ url, appId }) => {
          wsRef.current?.close();

          if (!playerRef.current) {
            playerRef.current = new PcmStreamPlayer(16000);
          }
          const player = playerRef.current;
          player.resume();
          player.reset();

          const ws = new WebSocket(url);
          wsRef.current = ws;

          ws.onopen = () => {
            setConnectionState('speaking');
            // UTF-8 文字 → base64（兼容中文）
            const bytes = new TextEncoder().encode(text);
            const binStr = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
            ws.send(JSON.stringify({
              common: { app_id: appId },
              business: {
                aue: 'raw',
                auf: 'audio/L16;rate=16000',
                vcn: 'xiaoyan',
                tte: 'utf8',
                speed: 50,
                volume: 50,
                pitch: 50,
              },
              data: { status: 2, text: btoa(binStr) },
            }));
          };

          ws.onmessage = (event) => {
            if (typeof event.data !== 'string') return;
            const frame = JSON.parse(event.data) as {
              code: number;
              data?: { audio?: string; status?: number };
            };
            if (frame.code !== 0) {
              ws.close();
              onFail();
              return;
            }
            if (frame.data?.audio) {
              const binary = Uint8Array.from(atob(frame.data.audio), c => c.charCodeAt(0));
              player.feed(binary.buffer);
            }
            if (frame.data?.status === 2) {
              setConnectionState('idle');
              setSpeaking(false);
              ws.close();
            }
          };

          ws.onerror = () => {
            setConnectionState('error');
            setSpeaking(false);
            onFail();
          };

          ws.onclose = () => {
            setConnectionState(prev => (prev === 'speaking' ? 'idle' : prev));
            setSpeaking(false);
          };
        })
        .catch(onFail);
    }

    function onFail() {
      if (!retried) {
        retried = true;
        setTimeout(tryXunfei, 500);
      } else {
        setConnectionState('idle');
        setSpeaking(false);
        speakLocal(text);
      }
    }

    tryXunfei();
  }, [speakLocal]);

  return { speak, speaking, connectionState };
}
