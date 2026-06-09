'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function getLang(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'zh';
  try {
    return (localStorage.getItem('language') as 'zh' | 'en') ?? 'zh';
  } catch {
    return 'zh';
  }
}

const SYNC_DIRECTION_LABELS = {
  zh: {
    sectionTitle: '同步方向',
    both: '双向同步（拉取 + 推送）',
    pull: '仅拉取（Google → CoreShift）',
    push: '仅推送（CoreShift → Google）',
  },
  en: {
    sectionTitle: 'Sync Direction',
    both: 'Bidirectional (pull + push)',
    pull: 'Pull only (Google → CoreShift)',
    push: 'Push only (CoreShift → Google)',
  },
} as const;

interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
  accessRole: string;
  primary: boolean;
}

export default function SetupCalendarsPage() {
  const router = useRouter();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultWrite, setDefaultWrite] = useState('primary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectDialog, setDisconnectDialog] = useState(false);
  const [syncDirection, setSyncDirection] = useState<'pull' | 'push' | 'both'>('both');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  useEffect(() => {
    setLang(getLang());
    fetch('/api/google/calendars')
      .then((r) => r.json())
      .then((data: GoogleCalendar[]) => {
        setCalendars(data);
        const writeable = data.filter((c) => c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader');
        setSelected(new Set(writeable.map((c) => c.id)));
        const primary = data.find((c) => c.primary);
        if (primary) setDefaultWrite(primary.id);
      })
      .catch(() => setError(lang === 'zh' ? '无法获取日历列表，请检查网络或重新授权' : 'Failed to load calendars. Check network or re-authorize.'))
      .finally(() => setLoading(false));

    fetch('/api/google/calendars/select/current')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.syncDirection) setSyncDirection(data.syncDirection);
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDisconnect(deleteEvents: boolean) {
    setDisconnecting(true);
    try {
      await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteEvents }),
      });
      router.push('/');
    } catch {
      setError('断开失败，请重试');
      setDisconnecting(false);
    }
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setError('请至少选择一个日历');
      return;
    }
    setSaving(true);
    try {
      await fetch('/api/google/calendars/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCalendarIds: Array.from(selected),
          defaultWriteCalendarId: defaultWrite,
          syncDirection,
        }),
      });
      router.push('/');
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        正在读取你的 Google 日历列表…
      </div>
    );
  }

  if (error && calendars.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">{error}</p>
          <a href="/api/auth/google" className="text-blue-600 text-sm underline">重新授权</a>
        </div>
      </div>
    );
  }

  const writeable = calendars.filter((c) => c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader');
  const readonly = calendars.filter((c) => c.accessRole === 'reader' || c.accessRole === 'freeBusyReader');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">选择要同步的日历</h1>
          <p className="text-xs text-gray-500 mt-1">勾选后，这些日历的事件将与 CoreShift 双向同步</p>
        </div>

        {/* 可写日历 */}
        <div className="space-y-2">
          {writeable.map((cal) => (
            <label key={cal.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(cal.id)}
                onChange={() => toggle(cal.id)}
                className="w-4 h-4 rounded"
              />
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="text-sm text-gray-700 flex-1">{cal.summary}</span>
              {cal.primary && <span className="text-xs text-gray-400">主日历</span>}
            </label>
          ))}
        </div>

        {readonly.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">只读日历（不可同步）</p>
            {readonly.map((cal) => (
              <div key={cal.id} className="flex items-center gap-3 p-2.5 opacity-40">
                <span className="w-4 h-4" />
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
                <span className="text-sm text-gray-500">{cal.summary}</span>
              </div>
            ))}
          </div>
        )}

        {/* 默认写入日历 */}
        {writeable.length > 1 && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">语音新建事件默认写入</p>
            <select
              value={defaultWrite}
              onChange={(e) => setDefaultWrite(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {writeable.filter((c) => selected.has(c.id)).map((cal) => (
                <option key={cal.id} value={cal.id}>{cal.summary}</option>
              ))}
            </select>
          </div>
        )}

        {/* 同步方向 */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">{SYNC_DIRECTION_LABELS[lang].sectionTitle}</p>
          <div className="space-y-1.5">
            {(['both', 'pull', 'push'] as const).map((dir) => (
              <label key={dir} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="syncDirection"
                  value={dir}
                  checked={syncDirection === dir}
                  onChange={() => setSyncDirection(dir)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-gray-700">{SYNC_DIRECTION_LABELS[lang][dir]}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={saving || selected.size === 0}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? '保存中…' : `确认同步 ${selected.size} 个日历`}
        </button>

        <button
          onClick={() => setDisconnectDialog(true)}
          disabled={disconnecting}
          className="w-full py-2 text-xs text-gray-400 hover:text-red-500 transition"
        >
          断开 Google 账号
        </button>
      </div>

      {disconnectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 flex flex-col gap-4">
            <h3 className="text-base font-medium text-gray-800">断开 Google 日历</h3>
            <p className="text-sm text-gray-600">是否同时删除从 Google 同步的事件？</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setDisconnectDialog(false); handleDisconnect(false); }}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
              >
                断开，保留事件
              </button>
              <button
                onClick={() => { setDisconnectDialog(false); handleDisconnect(true); }}
                className="w-full py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 transition"
              >
                断开，同时删除 Google 事件
              </button>
              <button
                onClick={() => setDisconnectDialog(false)}
                className="w-full py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
