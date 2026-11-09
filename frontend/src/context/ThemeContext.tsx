import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'slate' | 'midnight' | 'titanium' | 'amethyst' | 'nordic' | 'light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  category: 'dark' | 'light';
  previewColor: string;
  accentColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'slate',
    name: 'Slate Indigo',
    category: 'dark',
    previewColor: '#0f172a',
    accentColor: '#6366f1',
  },
  {
    id: 'midnight',
    name: 'Midnight Emerald',
    category: 'dark',
    previewColor: '#030712',
    accentColor: '#10b981',
  },
  {
    id: 'titanium',
    name: 'Titanium Crimson',
    category: 'dark',
    previewColor: '#111827',
    accentColor: '#f43f5e',
  },
  {
    id: 'amethyst',
    name: 'Deep Amethyst',
    category: 'dark',
    previewColor: '#090514',
    accentColor: '#a855f7',
  },
  {
    id: 'nordic',
    name: 'Nordic Cyan',
    category: 'dark',
    previewColor: '#04161f',
    accentColor: '#06b6d4',
  },
  {
    id: 'light',
    name: 'Executive Light',
    category: 'light',
    previewColor: '#f8fafc',
    accentColor: '#4f46e5',
  },
];

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  availableThemes: ThemeOption[];
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'pipeline_active_theme_v2';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
      if (stored && THEME_OPTIONS.some(t => t.id === stored)) {
        return stored;
      }
    } catch {}
    return 'slate';
  });

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        availableThemes: THEME_OPTIONS,
        isLight: theme === 'light',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
