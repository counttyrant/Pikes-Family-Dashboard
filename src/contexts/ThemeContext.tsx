import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ThemeName, ThemeDefinition } from '../types';
import { getSettings, saveSettings } from '../services/storage';

// ---------------------------------------------------------------------------
// Theme presets
// ---------------------------------------------------------------------------

export const THEMES: ThemeDefinition[] = [
  {
    name: 'ocean',
    label: 'Ocean',
    emoji: '🌊',
    bgFrom: '#0f172a',
    bgVia: '#172554',
    bgTo: '#1e1b4b',
    accent: '#3b82f6',
    accentLight: '#60a5fa',
    card: 'rgba(30, 41, 59, 0.7)',
    cardHover: 'rgba(30, 41, 59, 0.85)',
  },
  {
    name: 'forest',
    label: 'Forest',
    emoji: '🌲',
    bgFrom: '#0f172a',
    bgVia: '#052e16',
    bgTo: '#022c22',
    accent: '#22c55e',
    accentLight: '#4ade80',
    card: 'rgba(20, 43, 30, 0.7)',
    cardHover: 'rgba(20, 43, 30, 0.85)',
  },
  {
    name: 'sunset',
    label: 'Sunset',
    emoji: '🌅',
    bgFrom: '#431407',
    bgVia: '#450a0a',
    bgTo: '#0f172a',
    accent: '#f97316',
    accentLight: '#fb923c',
    card: 'rgba(67, 20, 7, 0.7)',
    cardHover: 'rgba(67, 20, 7, 0.85)',
  },
  {
    name: 'purple',
    label: 'Purple',
    emoji: '💜',
    bgFrom: '#0f172a',
    bgVia: '#3b0764',
    bgTo: '#2e1065',
    accent: '#a855f7',
    accentLight: '#c084fc',
    card: 'rgba(46, 16, 101, 0.7)',
    cardHover: 'rgba(46, 16, 101, 0.85)',
  },
  {
    name: 'rose',
    label: 'Rose',
    emoji: '🌹',
    bgFrom: '#0f172a',
    bgVia: '#4c0519',
    bgTo: '#500724',
    accent: '#f43f5e',
    accentLight: '#fb7185',
    card: 'rgba(76, 5, 25, 0.7)',
    cardHover: 'rgba(76, 5, 25, 0.85)',
  },
  {
    name: 'slate',
    label: 'Slate',
    emoji: '🪨',
    bgFrom: '#0f172a',
    bgVia: '#1e293b',
    bgTo: '#111827',
    accent: '#64748b',
    accentLight: '#94a3b8',
    card: 'rgba(30, 41, 59, 0.7)',
    cardHover: 'rgba(30, 41, 59, 0.85)',
  },
  {
    name: 'midnight',
    label: 'Midnight',
    emoji: '🌙',
    bgFrom: '#030712',
    bgVia: '#1e1b4b',
    bgTo: '#172554',
    accent: '#6366f1',
    accentLight: '#818cf8',
    card: 'rgba(30, 27, 75, 0.7)',
    cardHover: 'rgba(30, 27, 75, 0.85)',
  },
  {
    name: 'emerald',
    label: 'Emerald',
    emoji: '💎',
    bgFrom: '#0f172a',
    bgVia: '#042f2e',
    bgTo: '#022c22',
    accent: '#14b8a6',
    accentLight: '#2dd4bf',
    card: 'rgba(4, 47, 46, 0.7)',
    cardHover: 'rgba(4, 47, 46, 0.85)',
  },
];

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyTheme(def: ThemeDefinition): void {
  const root = document.documentElement;
  root.style.setProperty('--theme-bg-from', def.bgFrom);
  root.style.setProperty('--theme-bg-via', def.bgVia);
  root.style.setProperty('--theme-bg-to', def.bgTo);
  root.style.setProperty('--theme-accent', def.accent);
  root.style.setProperty('--theme-accent-light', def.accentLight);
  root.style.setProperty('--theme-card', def.card);
  root.style.setProperty('--theme-card-hover', def.cardHover);
}

function getDefinition(name: ThemeName): ThemeDefinition {
  return THEMES.find((t) => t.name === name) ?? THEMES[0];
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('ocean');

  // Load persisted theme on mount
  useEffect(() => {
    let cancelled = false;

    getSettings().then((settings) => {
      if (!cancelled && settings.theme) {
        setThemeState(settings.theme);
        applyTheme(getDefinition(settings.theme));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    applyTheme(getDefinition(theme));
  }, [theme]);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeState(name);
    saveSettings({ theme: name });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, themes: THEMES }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
