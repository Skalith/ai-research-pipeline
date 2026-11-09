import React from 'react';
import {
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeSelector } from '../common/ThemeSelector';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onNavigate: (view: string) => void;
  onOpenConfig: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onNavigate,
  onOpenConfig,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const { user, role, signout } = useAuth();
  const isResearcher = role === 'researcher' || role === 'admin';

  // Responsive short title for mobile phones so it never crowds buttons
  const getShortTitle = (fullTitle: string) => {
    if (fullTitle.startsWith('Research Dashboard')) return 'Dashboard';
    if (fullTitle.startsWith('New Research Job')) return 'New Job';
    if (fullTitle.startsWith('Admin Console')) return 'Admin';
    if (fullTitle.startsWith('Workspace')) return 'Workspace';
    return fullTitle;
  };

  return (
    <header className="h-14 sm:h-16 px-2.5 sm:px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30 select-none">
      {/* Zone 1: Hamburger & Responsive Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-1">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-900 shrink-0 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0 flex items-center gap-1.5 sm:gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight whitespace-nowrap truncate max-w-[110px] sm:max-w-none">
            <span className="sm:hidden">{getShortTitle(title)}</span>
            <span className="hidden sm:inline">{title}</span>
          </h1>

          {subtitle && (
            <div className="hidden sm:flex items-center gap-1.5 min-w-0">
              <span className="text-slate-600 shrink-0" aria-hidden="true">·</span>
              <span className="text-xs text-slate-400 truncate max-w-[100px] md:max-w-[200px] font-mono">
                {subtitle}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Action Controls (Optimized spacing: zero overlapping on mobile) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* 1. Theme Selector (Always accessible, compact on mobile) */}
        <ThemeSelector compact={true} />

        {/* 2. Connection Settings */}
        <button
          type="button"
          onClick={onOpenConfig}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="Configure API connection"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px] font-mono whitespace-nowrap">API Config</span>
        </button>

        {/* 3. New Research Job Button */}
        {isResearcher && (
          <button
            type="button"
            onClick={() => onNavigate('new-job')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            title="Launch New Research Job"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">New Research Job</span>
            <span className="hidden sm:inline md:hidden whitespace-nowrap">New Job</span>
            <span className="sm:hidden whitespace-nowrap text-[11px]">New</span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

        {/* 4. User profile & signout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="text-right hidden xl:block min-w-0">
            <p className="text-xs text-slate-300 font-medium truncate max-w-[150px] leading-tight">
              {user?.email}
            </p>
            <p className="text-[10px] text-slate-500 capitalize leading-tight">
              {role}
            </p>
          </div>

          <div className="hidden sm:flex xl:hidden items-center px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono capitalize shrink-0">
            {role}
          </div>

          <button
            type="button"
            onClick={() => signout()}
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            title="Sign out of account"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
