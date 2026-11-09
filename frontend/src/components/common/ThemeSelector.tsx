import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { ThemeId, useTheme } from '../../context/ThemeContext';

interface ThemeSelectorProps {
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ compact = false }) => {
  const { theme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = availableThemes.find(t => t.id === theme) || availableThemes[0];

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        title="Change UI Theme"
        aria-label="Change UI Theme"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0 border border-white/20"
          style={{ backgroundColor: currentTheme.accentColor }}
        />
        <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {!compact && (
          <span className="hidden lg:inline text-[11px] font-medium text-slate-300">
            {currentTheme.name}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
            Select Color Theme (6 Modes)
          </div>
          <div className="space-y-0.5">
            {availableThemes.map(t => {
              const isActive = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-xs"
                      style={{ backgroundColor: t.accentColor }}
                    />
                    <span className="truncate text-left text-xs">{t.name}</span>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
