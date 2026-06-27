'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'color';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('color');

  useEffect(() => {
    const saved = localStorage.getItem('en_theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'color') {
      setTheme(saved);
    } else {
      setTheme('color');
      localStorage.setItem('en_theme', 'color');
    }
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    setTheme(t);
    localStorage.setItem('en_theme', t);
    if (t === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }, []);

  return { theme, applyTheme };
}
