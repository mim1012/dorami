'use client';

import { useTheme } from '@/lib/theme/theme-context';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-10 h-10 rounded-full bg-content-bg border border-border-color flex items-center justify-center transition-all duration-200 hover:bg-hot-pink hover:text-white hover:scale-105"
      title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label="테마 전환"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
