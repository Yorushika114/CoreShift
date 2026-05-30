'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { labels, type LangKey, type LabelKeys } from '@/lib/i18n';

export type BgType = 'none' | 'url' | 'file';

export interface Settings {
  use24h: boolean;
  language: LangKey;
  timezone: string;
  bgType: BgType;
  bgValue: string;
}

interface SettingsContextValue extends Settings {
  setUse24h: (v: boolean) => void;
  setLanguage: (v: LangKey) => void;
  setTimezone: (v: string) => void;
  setBg: (type: BgType, value: string) => void;
  t: (key: LabelKeys) => string;
}

const SettingsContext = createContext<SettingsContextValue>({
  use24h: true,
  language: 'zh',
  timezone: 'Asia/Shanghai',
  bgType: 'none',
  bgValue: '',
  setUse24h: () => {},
  setLanguage: () => {},
  setTimezone: () => {},
  setBg: () => {},
  t: (key) => key,
});

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full — callers handle UI feedback
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [use24h, setUse24hState] = useState<boolean>(true);
  const [language, setLanguageState] = useState<LangKey>('zh');
  const [timezone, setTimezoneState] = useState<string>('Asia/Shanghai');
  const [bgType, setBgTypeState] = useState<BgType>('none');
  const [bgValue, setBgValueState] = useState<string>('');

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const savedUse24h = localStorage.getItem('cs_use24h');
    if (savedUse24h !== null) setUse24hState(savedUse24h === 'true');

    const savedLang = localStorage.getItem('cs_language');
    if (savedLang === 'zh' || savedLang === 'en') setLanguageState(savedLang);

    const savedTz = localStorage.getItem('cs_timezone');
    if (savedTz) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: savedTz });
        setTimezoneState(savedTz);
      } catch {
        setTimezoneState(Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    } else {
      setTimezoneState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }

    const savedBgType = localStorage.getItem('cs_bgType');
    if (savedBgType === 'url' || savedBgType === 'file' || savedBgType === 'none') {
      setBgTypeState(savedBgType);
    }

    const savedBgValue = localStorage.getItem('cs_bgValue') ?? '';
    setBgValueState(savedBgValue);
  }, []);

  const setUse24h = useCallback((v: boolean) => {
    save('cs_use24h', String(v));
    setUse24hState(v);
  }, []);

  const setLanguage = useCallback((v: LangKey) => {
    save('cs_language', v);
    setLanguageState(v);
  }, []);

  const setTimezone = useCallback((v: string) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: v });
      save('cs_timezone', v);
      setTimezoneState(v);
    } catch {
      // Invalid timezone string — silently ignore
    }
  }, []);

  const setBg = useCallback((type: BgType, value: string) => {
    try {
      localStorage.setItem('cs_bgType', type);
      localStorage.setItem('cs_bgValue', value);
      setBgTypeState(type);
      setBgValueState(value);
    } catch {
      throw new Error('storage_full');
    }
  }, []);

  const t = useCallback((key: LabelKeys): string => {
    return (labels[language] as Record<string, string>)[key] ?? key;
  }, [language]);

  return (
    <SettingsContext.Provider value={{ use24h, language, timezone, bgType, bgValue, setUse24h, setLanguage, setTimezone, setBg, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
