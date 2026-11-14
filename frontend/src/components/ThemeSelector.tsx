/**
 * Shared Theme Selector Component
 * Used in Navbar Master Dropdown and User Dropdown.
 */

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeSelectorProps {
  variant?: 'default' | 'compact';
}

const THEME_OPTIONS = [
  {
    id: 'light' as const,
    label: 'Terang',
    title: 'Mode Terang (Light Mode)',
    activeClass: 'bg-white text-slate-900 font-bold shadow-xs',
    compactActiveClass: 'bg-white text-slate-900 font-bold shadow-2xs',
    icon: Sun,
    iconClass: 'text-amber-500'
  },
  {
    id: 'dark' as const,
    label: 'Gelap',
    title: 'Mode Gelap (Dark Mode)',
    activeClass: 'bg-slate-900 text-white font-bold shadow-xs',
    compactActiveClass: 'bg-slate-900 text-white font-bold shadow-2xs',
    icon: Moon,
    iconClass: 'text-indigo-400'
  },
  {
    id: 'system' as const,
    label: 'Sistem',
    title: 'Ikuti Sistem Perangkat (System)',
    activeClass: 'bg-white text-slate-900 font-bold shadow-xs',
    compactActiveClass: 'bg-white text-slate-900 font-bold shadow-2xs',
    icon: Monitor,
    iconClass: 'text-blue-500'
  }
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ variant = 'default' }) => {
  const { themeMode, setThemeMode } = useTheme();
  const isCompact = variant === 'compact';

  return (
    <div
      className={
        isCompact
          ? 'px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700'
          : 'px-3 py-2 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700'
      }
    >
      <div
        className={`text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between ${
          isCompact ? 'mb-1' : 'mb-1.5'
        }`}
      >
        <span>{isCompact ? 'Tema Tampilan' : 'Pilih Mode Tampilan (Theme)'}</span>
        <span
          className={`font-mono text-[9px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 rounded capitalize ${
            isCompact ? 'px-1' : 'px-1.5 py-0.2 font-semibold'
          }`}
        >
          {themeMode}
        </span>
      </div>

      <div
        className={`grid grid-cols-3 gap-1 p-1 font-medium ${
          isCompact
            ? 'bg-slate-200/70 dark:bg-slate-950 rounded-lg text-[11px]'
            : 'bg-slate-200/80 dark:bg-slate-950 rounded-xl text-xs'
        }`}
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = themeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setThemeMode(opt.id)}
              title={isCompact ? undefined : opt.title}
              className={`flex items-center justify-center transition-all ${
                isCompact ? 'py-0.5 px-1.5 rounded gap-1' : 'py-1 px-2 rounded-lg gap-1.5'
              } ${
                isActive
                  ? isCompact
                    ? opt.compactActiveClass
                    : opt.activeClass
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5 shrink-0'} ${opt.iconClass}`} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
