'use client';

import { useState, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

const TZ_LABELS: Record<string, { zh: string; en: string }> = {
  'Asia/Shanghai':       { zh: '中国 — 上海/北京 (UTC+8)',         en: 'China — Shanghai/Beijing (UTC+8)' },
  'Asia/Tokyo':          { zh: '日本 — 东京 (UTC+9)',               en: 'Japan — Tokyo (UTC+9)' },
  'Asia/Seoul':          { zh: '韩国 — 首尔 (UTC+9)',               en: 'South Korea — Seoul (UTC+9)' },
  'Asia/Singapore':      { zh: '新加坡 (UTC+8)',                    en: 'Singapore (UTC+8)' },
  'Asia/Kolkata':        { zh: '印度 — 加尔各答 (UTC+5:30)',        en: 'India — Kolkata (UTC+5:30)' },
  'Europe/London':       { zh: '英国 — 伦敦 (UTC+0/+1)',            en: 'UK — London (UTC+0/+1)' },
  'Europe/Paris':        { zh: '法国 — 巴黎 (UTC+1/+2)',            en: 'France — Paris (UTC+1/+2)' },
  'Europe/Berlin':       { zh: '德国 — 柏林 (UTC+1/+2)',            en: 'Germany — Berlin (UTC+1/+2)' },
  'America/New_York':    { zh: '美国 — 纽约 (UTC-5/-4)',            en: 'USA — New York (UTC-5/-4)' },
  'America/Chicago':     { zh: '美国 — 芝加哥 (UTC-6/-5)',          en: 'USA — Chicago (UTC-6/-5)' },
  'America/Denver':      { zh: '美国 — 丹佛 (UTC-7/-6)',            en: 'USA — Denver (UTC-7/-6)' },
  'America/Los_Angeles': { zh: '美国 — 洛杉矶 (UTC-8/-7)',          en: 'USA — Los Angeles (UTC-8/-7)' },
  'America/Sao_Paulo':   { zh: '巴西 — 圣保罗 (UTC-3)',             en: 'Brazil — São Paulo (UTC-3)' },
  'Africa/Cairo':        { zh: '埃及 — 开罗 (UTC+2)',               en: 'Egypt — Cairo (UTC+2)' },
  'UTC':                 { zh: 'UTC（协调世界时）',                  en: 'UTC (Coordinated Universal Time)' },
};

interface SettingsPanelProps {
  googleConnected: boolean;
  syncing: boolean;
  syncMsg: string | null;
  onSync: () => void;
  onDisconnect: (deleteEvents: boolean) => void;
}

export function SettingsPanel({ googleConnected, syncing, syncMsg, onSync, onDisconnect }: SettingsPanelProps) {
  const { use24h, language, timezone, bgType, bgValue, setUse24h, setLanguage, setTimezone, setBg, t } = useSettings();
  const TIMEZONES = Object.entries(TZ_LABELS).map(([value, labels]) => ({
    value,
    label: labels[language],
  }));
  const [open, setOpen] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState(bgType === 'url' ? bgValue : '');
  const [bgError, setBgError] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState(false);
  const [icsMsg, setIcsMsg] = useState<string | null>(null);
  const [icsImporting, setIcsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ bottom: number; left: number; width: number } | null>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  }

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
    if (file.size > 20 * 1024 * 1024) {
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
    <div className="border border-gray-200 rounded-lg">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-1.5">
          <span>⚙</span>
          <span className="font-medium">{t('settings')}</span>
        </span>
        <span className={`transition-transform duration-200 text-[10px] ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && panelPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto"
            style={{ bottom: panelPos.bottom, left: panelPos.left, width: panelPos.width, maxHeight: 'min(420px, calc(100vh - 120px))' }}
          ><div className="px-3 pt-3 pb-4 space-y-4">

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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
                    {t('googleConnected')}
                  </div>
                  <button
                    onClick={() => setDisconnectDialog(true)}
                    className="text-xs text-gray-400 hover:text-red-500 transition"
                  >
                    {language === 'zh' ? '断开' : 'Disconnect'}
                  </button>
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
                <a
                  href="/setup/calendars"
                  className="block text-center text-xs text-blue-500 hover:text-blue-700 transition"
                >
                  {language === 'zh' ? '管理同步日历' : 'Manage synced calendars'}
                </a>
                {disconnectDialog && (
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-80 flex flex-col gap-4">
                      <h3 className="text-base font-medium text-gray-800">
                        {language === 'zh' ? '断开 Google 日历' : 'Disconnect Google Calendar'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {language === 'zh' ? '是否同时删除从 Google 同步的事件？' : 'Also delete events synced from Google?'}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => { setDisconnectDialog(false); onDisconnect(false); }}
                          className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
                        >
                          {language === 'zh' ? '断开，保留事件' : 'Disconnect, keep events'}
                        </button>
                        <button
                          onClick={() => { setDisconnectDialog(false); onDisconnect(true); }}
                          className="w-full py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 transition"
                        >
                          {language === 'zh' ? '断开，同时删除 Google 事件' : 'Disconnect and delete Google events'}
                        </button>
                        <button
                          onClick={() => setDisconnectDialog(false)}
                          className="w-full py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
                        >
                          {language === 'zh' ? '取消' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

          <hr className="border-gray-100" />

          {/* ICS Import / Export */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">
              {language === 'zh' ? '日历导入 / 导出' : 'Import / Export'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => icsInputRef.current?.click()}
                disabled={icsImporting}
                className="flex-1 text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50 transition disabled:opacity-50"
              >
                {icsImporting
                  ? (language === 'zh' ? '导入中…' : 'Importing…')
                  : (language === 'zh' ? '📥 导入 .ics' : '📥 Import .ics')}
              </button>
              <a
                href="/api/ics/export"
                download="coreshift-export.ics"
                className="flex-1 text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50 transition text-center"
              >
                {language === 'zh' ? '📤 导出 .ics' : '📤 Export .ics'}
              </a>
            </div>
            <input
              ref={icsInputRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setIcsImporting(true);
                setIcsMsg(null);
                try {
                  const text = await file.text();
                  const res = await fetch('/api/ics/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: text,
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setIcsMsg(
                      language === 'zh'
                        ? `已导入 ${data.imported} 个，跳过 ${data.skipped} 个重复`
                        : `Imported ${data.imported}, skipped ${data.skipped} duplicates`
                    );
                  } else {
                    setIcsMsg(data.error ?? (language === 'zh' ? '导入失败' : 'Import failed'));
                  }
                } catch {
                  setIcsMsg(language === 'zh' ? '导入失败，请重试' : 'Import failed, please retry');
                } finally {
                  setIcsImporting(false);
                }
              }}
            />
            {icsMsg && <p className="text-xs text-gray-500 mt-1">{icsMsg}</p>}
          </div>

        </div></div>
        </>
      )}
    </div>
  );
}
