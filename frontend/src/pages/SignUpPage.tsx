import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  X
} from 'lucide-react';
import { ThemeSelector } from '../components/common/ThemeSelector';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

interface SignUpPageProps {
  onSwitchToSignIn: () => void;
  onOpenConfig: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSwitchToSignIn, onOpenConfig }) => {
  const { signup } = useAuth();
  const { notify } = useNotification();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);

  // Validate password length 8–100 characters per backend rule
  const isPasswordValidLength = password.length >= 8 && password.length <= 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter an email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage(`Password must be at least 8 characters long (currently ${password.length}).`);
      return;
    }
    if (password.length > 100) {
      setErrorMessage('Password cannot exceed 100 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({ email: trimmedEmail, password });
      notify('success', 'Researcher account created successfully');
    } catch (err: any) {
      const msg = err.message || 'Unable to complete registration.';
      setErrorMessage(msg);
      notify('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      return;
    }
    setIsForgotSubmitting(true);
    // UI placeholder ready for developer backend integration
    setTimeout(() => {
      setIsForgotSubmitting(false);
      setForgotStatus(`Recovery link sent to ${forgotEmail}. Check your inbox for reset instructions.`);
      notify('info', 'Password reset request dispatched');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
            R
          </div>
        </div>
        <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
          Create Researcher Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Public signup provisions standard researcher pipeline privileges
        </p>

        <div className="mt-6 bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-8 shadow-2xl backdrop-blur-sm">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="analyst@organization.org"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signup-password" className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-slate-500 font-mono">8–100 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 characters)"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 font-mono ${
                      isPasswordValidLength ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isPasswordValidLength ? <Check className="w-3 h-3" /> : '·'}
                    {password.length}/100 characters {isPasswordValidLength ? '(valid length)' : '(minimum 8)'}
                  </span>
                </div>
              )}

              {/* Visually distinct 'Forgot password?' text link below password input */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email || '');
                    setForgotStatus(null);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/60 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating researcher account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignIn}
                className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2 ml-1 cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Backend Connection status footer & Theme Selection */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-slate-500">
          <button
            onClick={onOpenConfig}
            className="text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            API Gateway Config
          </button>
          <span aria-hidden="true">·</span>
          <ThemeSelector compact={false} />
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Reset Password</h3>
                <p className="text-xs text-slate-400">Receive account recovery instructions</p>
              </div>
            </div>

            {forgotStatus ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{forgotStatus}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Return to Sign Up
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-signup-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Account email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-signup-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="your.email@organization.org"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    UI ready for your backend recovery endpoint function.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isForgotSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Recovery Link</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
