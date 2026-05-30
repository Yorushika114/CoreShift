'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    fetch('/api/google/calendars')
      .then((r) => r.json())
      .then((data: GoogleCalendar[]) => {
        setCalendars(data);
        // 默认全选可写日历
        const writeable = data.filter((c) => c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader');
        setSelected(new Set(writeable.map((c) => c.id)));
        const primary = data.find((c) => c.primary);
        if (primary) setDefaultWrite(primary.id);
      })
      .catch(() => setError('无法获取日历列表，请检查网络或重新授权'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={saving || selected.size === 0}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? '保存中…' : `确认同步 ${selected.size} 个日历`}
        </button>
      </div>
    </div>
  );
}
