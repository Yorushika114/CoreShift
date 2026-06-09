'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { LabelKeys } from '@/lib/i18n';
import type { TimeBudget } from '@/types';

const COLORS = [
  { key: 'emerald', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { key: 'blue',    dot: 'bg-blue-500',    ring: 'ring-blue-400' },
  { key: 'purple',  dot: 'bg-purple-500',  ring: 'ring-purple-400' },
  { key: 'orange',  dot: 'bg-orange-400',  ring: 'ring-orange-300' },
  { key: 'red',     dot: 'bg-red-500',     ring: 'ring-red-400' },
  { key: 'pink',    dot: 'bg-pink-500',    ring: 'ring-pink-400' },
  { key: 'indigo',  dot: 'bg-indigo-500',  ring: 'ring-indigo-400' },
  { key: 'yellow',  dot: 'bg-yellow-400',  ring: 'ring-yellow-300' },
];

type FormState = { label: string; keywords: string; targetHours: string; color: string };
const EMPTY: FormState = { label: '', keywords: '', targetHours: '5', color: 'emerald' };

export function BudgetEditModal({ onClose }: { onClose: () => void }) {
  const { t, language } = useSettings();
  const [budgets, setBudgets] = useState<TimeBudget[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/budgets');
    if (res.ok) setBudgets(await res.json());
  }

  useEffect(() => { load(); }, []);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY);
    setAdding(true);
  }

  function startEdit(b: TimeBudget) {
    setAdding(false);
    setEditingId(b.id);
    setForm({
      label: b.label,
      keywords: b.keywords,
      targetHours: String(Math.round(b.targetMinutes / 60 * 10) / 10),
      color: b.color,
    });
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.label.trim()) return;
    setSaving(true);
    const body = {
      label: form.label.trim(),
      keywords: form.keywords.trim(),
      targetMinutes: Math.round(parseFloat(form.targetHours || '1') * 60),
      color: form.color,
    };
    const res = editingId
      ? await fetch(`/api/budgets/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      cancelForm();
      await load();
      window.dispatchEvent(new Event('budget-updated'));
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    cancelForm();
    await load();
    window.dispatchEvent(new Event('budget-updated'));
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {language === 'en' ? 'Manage Weekly Goals' : '管理本周目标'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition text-lg leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Budget list — hidden when adding new */}
          {!adding && (budgets.length === 0 && editingId === null ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">{t('budgetEmpty')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {budgets.map(b => {
                const col = COLORS.find(c => c.key === b.color) ?? COLORS[0];
                const isEditing = editingId === b.id;
                return (
                  <div key={b.id}>
                    {/* Row */}
                    <button
                      onClick={() => isEditing ? cancelForm() : startEdit(b)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'} transition`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{b.label}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {b.keywords || (language === 'en' ? 'No keywords' : '无关键词')}
                          {' · '}
                          {Math.floor(b.targetMinutes / 60)}{t('budgetHours')}
                          {b.targetMinutes % 60 > 0 ? (b.targetMinutes % 60) + t('budgetMins') : ''}
                          {language === 'en' ? '/wk' : '/周'}
                        </p>
                      </div>
                    </button>

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="px-5 pb-4 pt-2 bg-blue-50 border-b border-blue-100 space-y-3">
                        <FormFields form={form} setForm={setForm} language={language} t={t} />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving || !form.label.trim()}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg py-1.5 text-sm transition"
                          >
                            {saving ? '…' : t('budgetSave')}
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={deletingId === b.id}
                            className="px-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm border border-red-200 hover:border-red-300 transition"
                          >
                            {deletingId === b.id ? '…' : t('budgetDelete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Add form */}
          {adding && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">{t('budgetAdd')}</p>
              <FormFields form={form} setForm={setForm} language={language} t={t} />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.label.trim()}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg py-1.5 text-sm transition"
                >
                  {saving ? '…' : t('budgetSave')}
                </button>
                <button
                  onClick={cancelForm}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg py-1.5 text-sm transition"
                >
                  {t('budgetCancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!adding && editingId === null && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button
              onClick={startAdd}
              className="w-full text-sm border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 text-gray-500 rounded-lg py-2 transition"
            >
              + {t('budgetAdd')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormFields({
  form, setForm, language, t,
}: {
  form: { label: string; keywords: string; targetHours: string; color: string };
  setForm: React.Dispatch<React.SetStateAction<{ label: string; keywords: string; targetHours: string; color: string }>>;
  language: string;
  t: (k: LabelKeys) => string;
}) {
  return (
    <>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('budgetLabel')}</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder={language === 'en' ? 'e.g. Exercise' : '例：运动'}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('budgetKeywords')}</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={form.keywords}
          onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
          placeholder={language === 'en' ? 'run, gym, swim' : '跑步,健身,游泳'}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('budgetTarget')}</label>
        <input
          type="number" min="0.5" step="0.5"
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={form.targetHours}
          onChange={e => setForm(f => ({ ...f, targetHours: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('budgetColor')}</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => setForm(f => ({ ...f, color: c.key }))}
              className={`w-5 h-5 rounded-full ${c.dot} ${form.color === c.key ? `ring-2 ring-offset-1 ${c.ring}` : ''}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
