/* Theme: 'dark' | 'light' | 'system'.

   'system' stores nothing and removes the attribute, letting the
   prefers-color-scheme block in tokens.css take over. The no-flash script in
   index.html reads the same key before first paint. */

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { loadPrefs, savePrefs } from '../lib/entries.js';

const ThemeContext = createContext(null);
const VALID = ['dark', 'light', 'system'];

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = loadPrefs().theme;
    return VALID.includes(stored) ? stored : 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return;
    setThemeState(next);
    savePrefs({ ...loadPrefs(), theme: next });
  }, []);

  /* Two-state toggle. 'system' resolves to whatever the OS currently reports so
     the first tap flips to the opposite of what the user is actually seeing. */
  const toggleTheme = useCallback(() => {
    const resolved =
      theme === 'system'
        ? window.matchMedia?.('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme;
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
