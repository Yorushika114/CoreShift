'use client';

import { useState, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

const TIMEZONES = [
  { value: 'Asia/Shanghai',       label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo',          label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Seoul',          label: 'Asia/Seoul (UTC+9)' },
  { value: 'Asia/Singapore',      label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Kolkata',        label: 'Asia/Kolkata (UTC+5:30)' },
  { value: 'Europe/London',       label: 'Europe/London (UTC+0/+1)' },
  { value: 'Europe/Paris',        label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin',       label: 'Europe/Berlin (UTC+1/+2)' },
  { value: 'America/New_York',    label: 'America/New_York (UTC-5/-4)' },
  { value: 'America/Chicago',     label: 'America/Chicago (UTC-6/-5)' },
  { value: 'America/Denver',      label: 'America/Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8/-7)' },
  { value: 'America/Sao_Paulo',   label: 'America/Sao_Paulo (UTC-3)' },
  { value: 'Africa/Cairo',        label: 'Africa/Cairo (UTC+2)' },
  { value: 'UTC',                 label: 'UTC' },
];

interface SettingsPanelProps {
  googleConnected: boolean;
  syncing: boolean;
  syncMsg: string | null;
  onSync: () => void;
}

export function SettingsPanel({ googleConnected, syncing, syncMsg, onSync }: SettingsPanelProps) {
  const { use24h, language, timezone, bgType, bgValue, setUse24h, setLanguage, setTimezone, setBg, t } = useSettings();
  const [open, setOpen] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState(bgType === 'url' ? bgValue : '');
  const [bgError, setBgError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleBgUrlBlur() {
    const url = bgUrlInput.trim();
    if (!url) {
      setBg('none', '');
      setBgError(null);
      return;
    }
    const img = new Image();
    img.onload = () => { setBg('url', url); setBgError(null); };
    img.onerror = () => setBgError(t('bgInvalidUrl'));
    img.src = url;
  }

  function handleFileUpload(file: File) {
    setBgError(null);
    if (file.size > 2 * 1024 * 1024) {
      setBgError(t('bgTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target?.result as string;
      try {
        setBg('file', base64);
      } catch {
        setBgError(t('bgStorageFull'));
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span>⚙</span>
          <span className="font-medium">{t('settings')}</span>
        </span>
        <span className={`transition-transform duration-200 text-[10px] ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-4">

          {/* Time format */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('timeFormat')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setUse24h(false)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${!use24h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{t('h12')}</button>
              <button
                onClick={() => setUse24h(true)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${use24h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{t('h24')}</button>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('timezone')}</p>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('language')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('zh')}
                className={`flex-1 text-xs py-1 rounded transition-colors ${language === 'zh' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{t('langZh')}</button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 text-xs py-1 rounded transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{t('langEn')}</button>
            </div>
          </div>

          {/* Background */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('background')}</p>
            <div className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                value={bgUrlInput}
                onChange={e => setBgUrlInput(e.target.value)}
                onBlur={handleBgUrlBlur}
                placeholder={t('bgUrlPlaceholder')}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap flex-shrink-0"
              >{t('bgUpload')}</button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = '';
              }}
            />
            {bgError && <p className="text-xs text-red-500">{bgError}</p>}
            {bgType !== 'none' && bgValue && (
              <button
                onClick={() => { setBg('none', ''); setBgUrlInput(''); setBgError(null); }}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1"
              >{t('bgClear')}</button>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Google Calendar */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('googleSection')}</p>
            {googleConnected ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
                  {t('googleConnected')}
                </div>
                <button
                  onClick={onSync}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-1.5 border border-gray-200 rounded py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  <span>{syncing ? '⏳' : '🔄'}</span>
                  {syncing ? t('syncing') : t('googleSync')}
                </button>
                {syncMsg && <p className="text-xs text-gray-500">{syncMsg}</p>}
              </div>
            ) : (
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-1.5 border border-gray-200 rounded py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
              >
                <span>🗓</span>
                {t('googleConnect')}
              </a>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
