import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Compass,
  Globe,
  Info,
  Loader2,
  Plus,
  Send,
  Trash2
} from 'lucide-react';
import { jobsApi } from '../api/jobsApi';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

interface NewJobPageProps {
  onBackToDashboard: () => void;
  onJobCreated: (jobId: string) => void;
}

export const NewJobPage: React.FC<NewJobPageProps> = ({
  onBackToDashboard,
  onJobCreated,
}) => {
  const { role } = useAuth();
  const { notify } = useNotification();
  const isResearcher = role === 'researcher' || role === 'admin';

  const [query, setQuery] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Character count validations
  const queryTrimmed = query.trim();
  const isQueryLengthValid = queryTrimmed.length >= 3 && queryTrimmed.length <= 1000;

  // Add URL to list
  const handleAddUrl = () => {
    setUrlInputError(null);
    const trimmed = currentUrlInput.trim();
    if (!trimmed) return;

    if (urls.length >= 50) {
      setUrlInputError('Maximum of 50 seed URLs allowed per research job.');
      return;
    }

    if (trimmed.length > 2048) {
      setUrlInputError('URL exceeds maximum allowed length of 2,048 characters.');
      return;
    }

    // Validate absolute HTTP/HTTPS URL
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlInputError('URL must use http:// or https:// protocol.');
        return;
      }
    } catch {
      setUrlInputError('Please enter a valid absolute HTTP/HTTPS URL (e.g. https://arxiv.org/abs/...)');
      return;
    }

    if (urls.includes(trimmed)) {
      setUrlInputError('This URL is already in your seed list.');
      return;
    }

    setUrls([...urls, trimmed]);
    setCurrentUrlInput('');
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!isQueryLengthValid) {
      setApiError('Research query must be between 3 and 1,000 characters.');
      return;
    }

    // If there's text remaining in the URL input box, attempt to add it
    if (currentUrlInput.trim()) {
      handleAddUrl();
    }

    setIsSubmitting(true);

    try {
      // Generate a unique idempotency key
      const idempotencyKey = `job-req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      const createdJob = await jobsApi.createJob({
        query: queryTrimmed,
        urls: urls,
        idempotency_key: idempotencyKey,
      });

      notify('success', `Research job accepted [${createdJob.id}]`);
      onJobCreated(createdJob.id);
    } catch (err: any) {
      const msg = err.message || 'Failed to dispatch research job.';
      setApiError(msg);
      notify('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isResearcher) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-100">Restricted Action</h3>
          <p className="mt-1 text-xs text-slate-400">
            Your current role ({role}) has view-only access. Only researchers and administrators can create new research pipelines.
          </p>
          <button
            onClick={onBackToDashboard}
            className="mt-6 px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-1">
            <Compass className="w-3.5 h-3.5" />
            <span>Autonomous Pipeline Orchestration</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
            Launch New Research Job
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Define your core analytical investigation query. The multi-agent crew will scrape, summarize, fact-check claims, and synthesize findings.
          </p>
        </div>

        {apiError && (
          <div className="mb-6 p-4 rounded-lg bg-rose-950/60 border border-rose-800/70 flex items-start gap-3 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200 mb-0.5">Request Error</p>
              <p className="leading-relaxed">{apiError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Query Field (3–1000 characters) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="research-query" className="block text-xs font-semibold text-slate-200">
                Research Inquiry Query <span className="text-rose-400">*</span>
              </label>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  queryTrimmed.length > 1000 || (queryTrimmed.length > 0 && queryTrimmed.length < 3)
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {queryTrimmed.length}/1000 characters (min 3)
              </span>
            </div>
            <textarea
              id="research-query"
              rows={4}
              required
              minLength={3}
              maxLength={1000}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Evaluate current solid-state lithium battery electrolyte degradation mechanisms under fast charging cycles, focusing on interface impedance and dendrite suppression..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors leading-relaxed"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Be specific about technical domains, evaluation parameters, and desired synthesis depth.
            </p>
          </div>

          {/* Seed URLs List (Optional, max 50) */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-200">
                Optional Seed URLs <span className="text-slate-500 font-normal">({urls.length}/50)</span>
              </label>
              <span className="text-[11px] text-slate-500">Max 2,048 chars per URL</span>
            </div>

            {/* If no URLs are supplied, tell user backend will discover sources */}
            {urls.length === 0 && (
              <div className="mb-3 p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-200/90">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  No seed URLs supplied. The backend research agents will automatically discover and ingest authoritative peer-reviewed papers and domain sources matching your query.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <input
                  type="url"
                  value={currentUrlInput}
                  onChange={e => setCurrentUrlInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  placeholder="https://arxiv.org/abs/... or https://nature.com/articles/..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={!currentUrlInput.trim() || urls.length >= 50}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add URL</span>
              </button>
            </div>

            {urlInputError && (
              <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{urlInputError}</span>
              </p>
            )}

            {/* List of added URLs */}
            {urls.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {urls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs group"
                  >
                    <span className="font-mono text-[11px] text-slate-300 truncate max-w-xl">
                      {url}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      aria-label="Remove URL"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToDashboard}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isQueryLengthValid}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to Backend Pipeline...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Research Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
