import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { startThemeWave, type ThemeOrigin } from '../utils/themeWave';

interface ThemeContextValue {
  dark: boolean;
  toggle: (origin?: ThemeOrigin) => void;
}

const STORAGE_KEY = 'wh_theme';

function readStoredTheme(): 'light' | 'dark' | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    const stored = readStoredTheme();
    if (stored) return stored === 'dark';
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (!readStoredTheme()) setDark(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(
    (origin?: ThemeOrigin) => {
      const next = !dark;
      let point = origin;

      if (origin && origin.clientX === 0 && origin.clientY === 0) {
        const rect = document.activeElement?.getBoundingClientRect();
        if (rect) {
          point = {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          };
        }
      }

      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      } catch {}

      startThemeWave(point, () => {
        document.documentElement.classList.toggle('dark', next);
        setDark(next);
      });
    },
    [dark]
  );

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
