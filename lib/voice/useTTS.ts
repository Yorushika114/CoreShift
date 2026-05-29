'use client';

import { useCallback, useRef } from 'react';

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        console.error('[TTS] request failed:', res.status);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // 停止当前正在播放的音频
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch((err) => console.error('[TTS] playback error:', err));
    } catch (err) {
      console.error('[TTS] error:', err);
    }
  }, []);

  return { speak };
}
