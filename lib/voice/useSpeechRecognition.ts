'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 共享语音识别 hook，基于 Web Speech API。
 * 配置：lang=zh-CN / interimResults=true（实时显示临时文字）/ continuous=false（说完一句自动停）。
 *
 * 浮层与编辑面板内麦克风共用同一引擎。浏览器不支持时 supported=false，
 * 调用方据此降级为文字输入（CLAUDE.md 要求的文字兜底）。
 */

export type SpeechErrorKind = 'unsupported' | 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'audio-capture' | 'unknown';

export interface UseSpeechRecognitionOptions {
  lang?: string;
  /** 识别到最终结果时回调（已停止）。 */
  onResult?: (text: string) => void;
}

export interface UseSpeechRecognition {
  /** 浏览器是否支持 Web Speech API。false 时调用方应降级为文字输入。 */
  supported: boolean;
  listening: boolean;
  /** 边说边出的临时文字（未定稿）。 */
  interimText: string;
  error: SpeechErrorKind | null;
  start: () => void;
  stop: () => void;
}

function mapError(code: string): SpeechErrorKind {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    case 'audio-capture':
      return 'audio-capture';
    default:
      return 'unknown';
  }
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognition {
  const { lang = 'zh-CN', onResult } = options;

  // 同步检测支持情况。浮层/面板麦克风均在用户交互后才挂载（hydration 之后），
  // 故读取 window 不会引发 SSR 水合不一致，且首渲染即拿到正确值。
  const [supported] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<SpeechErrorKind | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // 把最新的 onResult 放进 ref，避免重建识别实例
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setInterimText(final);
        onResultRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event) => {
      setError(mapError(event.error));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('unsupported');
      return;
    }
    setError(null);
    setInterimText('');
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() 在已 listening 时会抛 InvalidStateError，忽略即可
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interimText, error, start, stop };
}
