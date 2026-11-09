import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ConfigModal } from './components/common/ConfigModal';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { DashboardPage } from './pages/DashboardPage';
import { NewJobPage } from './pages/NewJobPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { WorkspacePage } from './pages/WorkspacePage';

type AppView = 'dashboard' | 'new-job' | 'workspace' | 'admin';
type AuthView = 'signin' | 'signup';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [authView, setAuthView] = useState<AuthView>('signin');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-mono">Restoring research session...</p>
      </div>
    );
  }

  // Unauthenticated: Sign In or Sign Up
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return (
        <>
          <SignUpPage
            onSwitchToSignIn={() => setAuthView('signin')}
            onOpenConfig={() => setIsConfigOpen(true)}
          />
          <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
        </>
      );
    }
    return (
      <>
        <SignInPage
          onSwitchToSignUp={() => setAuthView('signup')}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      </>
    );
  }

  // Authenticated Application Shell
  const handleNavigate = (view: string) => {
    if (view === 'admin' && role !== 'admin') return;
    setCurrentView(view as AppView);
    setMobileMenuOpen(false);
  };

  const handleOpenWorkspace = (jobId: string) => {
    setActiveJobId(jobId);
    setCurrentView('workspace');
    setMobileMenuOpen(false);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Research Dashboard';
      case 'new-job':
        return 'New Research Job';
      case 'workspace':
        return `Workspace`;
      case 'admin':
        return 'Admin Console';
      default:
        return 'Research Pipeline';
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] h-full bg-slate-950 flex flex-col z-10 shadow-2xl border-r border-slate-800 animate-in slide-in-from-left duration-200">
            <Sidebar
              currentView={currentView}
              onNavigate={handleNavigate}
              onOpenConfig={() => {
                setIsConfigOpen(true);
                setMobileMenuOpen(false);
              }}
              onCloseMobile={() => setMobileMenuOpen(false)}
              isMobileDrawer={true}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={getPageTitle()}
          subtitle={currentView === 'workspace' && activeJobId ? activeJobId : undefined}
          onNavigate={handleNavigate}
          onOpenConfig={() => setIsConfigOpen(true)}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardPage
              onOpenNewJob={() => setCurrentView('new-job')}
              onOpenJobWorkspace={handleOpenWorkspace}
            />
          )}

          {currentView === 'new-job' && (
            <NewJobPage
              onBackToDashboard={() => setCurrentView('dashboard')}
              onJobCreated={jobId => handleOpenWorkspace(jobId)}
            />
          )}

          {currentView === 'workspace' && activeJobId && (
            <WorkspacePage
              jobId={activeJobId}
              onBackToDashboard={() => setCurrentView('dashboard')}
            />
          )}

          {currentView === 'admin' && (
            <AdminConsolePage onOpenJobWorkspace={handleOpenWorkspace} />
          )}
        </main>
      </div>

      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
