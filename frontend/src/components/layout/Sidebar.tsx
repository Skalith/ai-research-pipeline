import React from 'react';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Palette,
  PlusCircle,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeSelector } from '../common/ThemeSelector';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenConfig: () => void;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenConfig,
  onCloseMobile,
  isMobileDrawer = false,
}) => {
  const { user, role, signout } = useAuth();

  const isResearcher = role === 'researcher' || role === 'admin';
  const isAdmin = role === 'admin';

  return (
    <aside
      className={`bg-slate-950 flex flex-col shrink-0 select-none h-full ${
        isMobileDrawer ? 'w-full' : 'w-64 border-r border-slate-800/80'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tighter shadow-sm">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            Pipeline Console
          </span>
        </div>

        {/* Close button for mobile drawer */}
        {isMobileDrawer && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        <div>
          <p className="px-2 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Workspace
          </p>
          <nav className="space-y-1">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            {/* Researchers & Admins can create new jobs */}
            {isResearcher && (
              <button
                onClick={() => onNavigate('new-job')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  currentView === 'new-job'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>New Research Job</span>
              </button>
            )}

            {currentView === 'workspace' && (
              <button
                onClick={() => onNavigate('workspace')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/25 text-left cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Active Workspace</span>
              </button>
            )}
          </nav>
        </div>

        {/* Admin Navigation (Render ONLY when user.role is admin) */}
        {isAdmin && (
          <div>
            <p className="px-2 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Administration
            </p>
            <nav className="space-y-1">
              <button
                onClick={() => onNavigate('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Admin Console</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Footer / Account section - clean, unboxed, uncluttered */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950 space-y-2 shrink-0">
        <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-400 rounded-lg hover:bg-slate-900/50 transition-colors">
          <span className="flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Theme Mode</span>
          </span>
          <ThemeSelector compact={true} />
        </div>

        <button
          onClick={onOpenConfig}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-lg transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>API Gateway</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">Config</span>
        </button>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between px-2">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.email}</p>
            <p className="text-[10px] text-slate-500 capitalize">{role || 'Researcher'}</p>
          </div>
          <button
            onClick={() => signout()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
