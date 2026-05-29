'use client';

import { useEffect, useState } from 'react';
import { useSpeechRecognition, type SpeechErrorKind } from '@/lib/voice/useSpeechRecognition';

interface Props {
  /** 识别（或文字兜底）得到指令文本后回调，由页面据此打开编辑面板/路由。 */
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<SpeechErrorKind, string> = {
  unsupported: '当前浏览器不支持语音识别',
  'not-allowed': '麦克风权限被拒绝，请改用文字输入',
  'no-speech': '没听清，请再说一次或改用文字',
  network: '网络异常，请重试或改用文字',
  aborted: '识别已取消',
  unknown: '识别出错，请重试或改用文字',
};

export function VoiceCommandOverlay({ onSubmit, onClose }: Props) {
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');

  const { supported, listening, interimText, error, start, stop } = useSpeechRecognition({
    onResult: (text) => {
      if (text) onSubmit(text);
    },
  });

  // 打开时：支持语音则自动开始听；否则降级为文字输入
  useEffect(() => {
    if (supported) start();
    else setTextMode(true);
    // 仅在 supported 确定后执行一次
  }, [supported, start]);

  // 致命错误（权限/不支持）自动切到文字兜底
  useEffect(() => {
    if (error === 'not-allowed' || error === 'unsupported') setTextMode(true);
  }, [error]);

  function handleClose() {
    stop();
    onClose();
  }

  function submitText() {
    const t = textInput.trim();
    if (t) onSubmit(t);
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

        {!textMode ? (
          <div className="px-5 py-8 flex flex-col items-center gap-5">
            {/* Mic indicator */}
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

            {/* 实时识别文字 */}
            {interimText && (
              <p className="text-base text-gray-800 text-center break-words px-2">
                {interimText}
              </p>
            )}

            {/* 错误提示（非致命，可重试） */}
            {error && error !== 'not-allowed' && error !== 'unsupported' && (
              <p className="text-xs text-amber-600">{ERROR_MESSAGES[error]}</p>
            )}

            <p className="text-xs text-gray-400 text-center">
              例：明天下午3点开组会
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
            {error && (
              <p className="text-xs text-amber-600">{ERROR_MESSAGES[error]}</p>
            )}
            <textarea
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitText();
              }}
              placeholder={'用自然语言描述\n例：明天下午3点开组会'}
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
