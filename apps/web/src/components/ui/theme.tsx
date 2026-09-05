import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from './button';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'schematic-theme';

function preferred(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing and blocked site data both throw here; the media query
    // below is a perfectly good answer.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyStoredTheme(): void {
  document.documentElement.classList.toggle('dark', preferred() === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(preferred);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Nothing to do: the choice simply will not survive a reload.
    }
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
