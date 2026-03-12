'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full p-2 transition-colors"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? (
        <SunIcon size={18} weight="bold" />
      ) : (
        <MoonIcon size={18} weight="bold" />
      )}
    </button>
  );
}
