import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'camp-theme';

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readThemePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function applyTheme(pref: ThemePref) {
  const resolved = pref === 'system' ? systemTheme() : pref;
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/** Light/dark preference, persisted per browser, following the OS when set to "system". */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => applyTheme(readThemePref()));

  useEffect(() => {
    setResolved(applyTheme(pref));
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const setTheme = useCallback((next: ThemePref) => {
    localStorage.setItem(KEY, next);
    setPref(next);
  }, []);

  // Keep every hook instance in step with the attribute, whoever changed it.
  useEffect(() => {
    const mo = new MutationObserver(() => {
      const t = document.documentElement.dataset.theme;
      if (t === 'light' || t === 'dark') setResolved(t);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme]);

  return { pref, resolved, setTheme, toggle };
}
