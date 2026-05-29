'use client';

import { useCallback, useRef } from 'react';

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 浏览器内置合成（兜底），cancel 后延迟 50ms 避免开头截断
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
    // 明确离线时直接走浏览器合成，跳过网络请求
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      speakLocal(text);
      return;
    }

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(res => {
        if (!res.ok) throw new Error('tts api error');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play().catch(() => speakLocal(text));
      })
      .catch(() => {
        // 网络错误 / API 不可用 → 降级
        speakLocal(text);
      });
  }, [speakLocal]);

  return { speak };
}
