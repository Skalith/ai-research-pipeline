import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FileCode,
  FileDown,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  XCircle
} from 'lucide-react';
import { jobsApi } from '../api/jobsApi';
import { reportsApi } from '../api/reportsApi';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Claim, JobStatus, Report, ResearchJob, Source } from '../types';

interface WorkspacePageProps {
  jobId: string;
  onBackToDashboard: () => void;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  jobId,
  onBackToDashboard,
}) => {
  const { role } = useAuth();
  const { notify } = useNotification();
  const isResearcher = role === 'researcher' || role === 'admin';

  // State
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'claims' | 'sources'>('report');
  const [isLoadingJob, setIsLoadingJob] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab Data
  const [report, setReport] = useState<Report | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState<boolean>(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [claimFilter, setClaimFilter] = useState<string>('all');

  const [sources, setSources] = useState<Source[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  // Action Modals & States
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // SSE tracking controller
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Fetch job state
  const fetchJobState = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const data = await jobsApi.getJob(jobId);
      setJob(data);
      return data;
    } catch (err: any) {
      const msg = err.message || 'Unable to load research job details';
      setErrorMessage(msg);
      notify('error', msg);
      return null;
    } finally {
      setIsLoadingJob(false);
      setIsRefreshing(false);
    }
  };

  // Fetch Report
  const fetchReport = async () => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const data = await reportsApi.getReport(jobId);
      setReport(data);
    } catch (err: any) {
      setReportError(err.message || 'Report not available yet');
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Fetch Claims
  const fetchClaims = async () => {
    setIsLoadingClaims(true);
    setClaimsError(null);
    try {
      const data = await jobsApi.getClaims(jobId);
      setClaims(data || []);
    } catch (err: any) {
      setClaimsError(err.message || 'Unable to retrieve claims data');
    } finally {
      setIsLoadingClaims(false);
    }
  };

  // Fetch Sources
  const fetchSources = async () => {
    setIsLoadingSources(true);
    setSourcesError(null);
    try {
      const data = await jobsApi.getSources(jobId);
      setSources(data || []);
    } catch (err: any) {
      setSourcesError(err.message || 'Unable to retrieve sources data');
    } finally {
      setIsLoadingSources(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchJobState();
    fetchReport();
    fetchClaims();
    fetchSources();
  }, [jobId]);

  // Subscribe to SSE progress
  useEffect(() => {
    if (!job) return;

    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    if (terminalStatuses.includes((job.status || '').toLowerCase())) {
      // Terminal state: stop SSE tracking
      if (cancelStreamRef.current) {
        cancelStreamRef.current();
        cancelStreamRef.current = null;
      }
      return;
    }

    // Set up SSE stream
    let isSubscribed = true;

    jobsApi
      .subscribeToProgress(
        jobId,
        progressData => {
          if (!isSubscribed) return;

          setJob(prev => {
            if (!prev) return null;
            return {
              ...prev,
              status: progressData.status,
              stage: progressData.stage,
              progress: progressData.progress,
            };
          });

          // If reached terminal status, refresh all tab data
          const statusLower = (progressData.status || '').toLowerCase();
          if (terminalStatuses.includes(statusLower)) {
            fetchJobState(true);
            fetchReport();
            fetchClaims();
            fetchSources();
            if (cancelStreamRef.current) {
              cancelStreamRef.current();
              cancelStreamRef.current = null;
            }
          }
        },
        streamError => {
          // Reconnect or refresh job state after stream error
          console.warn('SSE stream error, re-polling job state:', streamError);
          fetchJobState(true);
        }
      )
      .then(cancelFn => {
        cancelStreamRef.current = cancelFn;
      });

    return () => {
      isSubscribed = false;
      if (cancelStreamRef.current) {
        cancelStreamRef.current();
        cancelStreamRef.current = null;
      }
    };
  }, [jobId, job?.status]);

  // Handle Cancel Job (Researchers only, for active non-terminal jobs)
  const handleCancelJob = async () => {
    setIsActionLoading(true);
    try {
      const updated = await jobsApi.cancelJob(jobId);
      setJob(updated);
      notify('info', 'Research job cancelled');
      setIsCancelModalOpen(false);
    } catch (err: any) {
      // Handle 409 conflict: refresh state and show error message
      notify('error', err.message || 'Failed to cancel job');
      fetchJobState(true);
      setIsCancelModalOpen(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Resume Job (Researchers only, for failed or cancelled jobs)
  const handleResumeJob = async () => {
    setIsActionLoading(true);
    try {
      const updated = await jobsApi.resumeJob(jobId);
      setJob(updated);
      notify('success', 'Research pipeline resumed');
    } catch (err: any) {
      // Handle 409 conflict: refresh state and show error message
      notify('error', err.message || 'Failed to resume job');
      fetchJobState(true);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Report Downloads (authenticated fetch as blob)
  const handleDownload = async (format: 'pdf' | 'docx' | 'markdown') => {
    setIsDownloading(format);
    setDownloadDropdownOpen(false);
    try {
      if (format === 'pdf') {
        await reportsApi.downloadPdf(jobId);
        notify('success', 'PDF report downloaded');
      } else if (format === 'docx') {
        await reportsApi.downloadDocx(jobId);
        notify('success', 'DOCX report downloaded');
      } else if (format === 'markdown') {
        await reportsApi.downloadMarkdown(jobId);
        notify('success', 'Markdown report downloaded');
      }
    } catch (err: any) {
      notify('error', err.message || `Failed to download ${format.toUpperCase()}`);
    } finally {
      setIsDownloading(null);
    }
  };

  if (isLoadingJob) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-xs text-slate-400">Loading research job workspace...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-100">Job Not Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            {errorMessage || `Unable to locate research job ID: ${jobId}`}
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

  const statusNorm = (job.status || 'pending').toLowerCase();
  const isActive = statusNorm === 'pending' || statusNorm === 'running' || statusNorm === 'processing';
  const isCancellable = isResearcher && isActive;
  const isResumable = isResearcher && (statusNorm === 'failed' || statusNorm === 'cancelled');

  // Filtered claims
  const filteredClaims = claims.filter(c => {
    if (claimFilter === 'all') return true;
    return (c.verdict || 'unverified').toLowerCase() === claimFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchJobState()}
            disabled={isRefreshing}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Refresh current state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">Sync State</span>
          </button>

          {/* Cancel button: Only for active researcher job */}
          {isCancellable && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <StopCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="whitespace-nowrap">Cancel Job</span>
            </button>
          )}

          {/* Resume button: Only for failed or cancelled researcher job */}
          {isResumable && (
            <button
              onClick={handleResumeJob}
              disabled={isActionLoading}
              className="px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span className="whitespace-nowrap">Resume Pipeline</span>
            </button>
          )}

          {/* Report Downloads Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {downloadDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => handleDownload('pdf')}
                  className="w-full px-3.5 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-indigo-400" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => handleDownload('docx')}
                  className="w-full px-3.5 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Download DOCX</span>
                </button>
                <button
                  onClick={() => handleDownload('markdown')}
                  className="w-full px-3.5 py-2 text-xs text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                >
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Download Markdown</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Job Workspace Card Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300 font-semibold">{job.id}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {job.created_at
                  ? new Date(job.created_at).toLocaleString()
                  : 'Time unavailable'}
              </span>
              {job.stage && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-400 font-medium">Stage: {job.stage.replace('_', ' ')}</span>
                </>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
              {job.query}
            </h2>

            {job.error && (
              <div className="mt-2 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Execution Error</p>
                  <p className="leading-relaxed">{job.error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Telemetry Status & Progress widget */}
          <div className="flex flex-row lg:flex-col items-end gap-3 shrink-0 pt-2 lg:pt-0">
            <StatusIndicator status={job.status} stage={job.stage} />

            <div className="w-40 sm:w-48 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Progress</span>
                <span className="tabular-nums font-semibold text-slate-200">
                  {job.progress !== undefined ? `${job.progress}%` : '0%'}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    statusNorm === 'completed'
                      ? 'bg-emerald-500'
                      : statusNorm === 'failed'
                      ? 'bg-rose-500'
                      : statusNorm === 'cancelled'
                      ? 'bg-slate-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${job.progress || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Multi-Agent Stage Tracker */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <p className="text-[11px] font-medium tracking-wider text-slate-500 uppercase mb-3">
            Multi-Agent Pipeline Progression
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {[
              { id: 'scraping', name: '1. Scraper Agent' },
              { id: 'summarizing', name: '2. Summarizer Agent' },
              { id: 'fact_checking', name: '3. Fact-Checker' },
              { id: 'writing', name: '4. Lead Writer' },
              { id: 'completed', name: '5. Executive Synthesis' },
            ].map(stageStep => {
              const currentStage = (job.stage || '').toLowerCase();
              const isDone =
                statusNorm === 'completed' ||
                (stageStep.id === 'scraping' && currentStage !== 'initialized' && currentStage !== 'scraping') ||
                (stageStep.id === 'summarizing' && !['initialized', 'scraping', 'summarizing'].includes(currentStage)) ||
                (stageStep.id === 'fact_checking' && ['writing', 'editing', 'reporting', 'completed'].includes(currentStage)) ||
                (stageStep.id === 'writing' && ['editing', 'reporting', 'completed'].includes(currentStage));

              const isCurrent = currentStage.includes(stageStep.id);

              return (
                <div
                  key={stageStep.id}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                      : isCurrent
                      ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-200 ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <p className="text-[11px] font-medium truncate">{stageStep.name}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    {isDone ? 'Finished' : isCurrent ? 'Active...' : 'Queued'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Interactive Segmented Controls) */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'report'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Synthesis Report</span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'claims'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified Claims</span>
          {claims.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-300 rounded font-mono">
              {claims.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'sources'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ingested Sources</span>
          {sources.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-300 rounded font-mono">
              {sources.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: REPORT */}
      {activeTab === 'report' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 sm:p-8">
          {isLoadingReport ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading intelligence report...</p>
            </div>
          ) : report ? (
            <div className="space-y-6">
              {report.title && (
                <div className="pb-4 border-b border-slate-800/80">
                  <h3 className="text-xl font-bold text-slate-100 tracking-tight">
                    {report.title}
                  </h3>
                  {report.executive_summary && (
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed italic bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                      {report.executive_summary}
                    </p>
                  )}
                </div>
              )}

              {/* Formatted Markdown content */}
              <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed space-y-4">
                {(report.markdown || '')
                  .split('\n\n')
                  .map((paragraph, idx) => {
                    const trimmed = paragraph.trim();
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1 key={idx} className="text-lg font-bold text-slate-100 mt-6 mb-2">
                          {trimmed.replace('# ', '')}
                        </h1>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2 key={idx} className="text-base font-semibold text-slate-100 mt-5 mb-2 pb-1 border-b border-slate-800">
                          {trimmed.replace('## ', '')}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('### ')) {
                      return (
                        <h3 key={idx} className="text-sm font-semibold text-slate-200 mt-4 mb-1">
                          {trimmed.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                      const items = trimmed.split('\n').filter(Boolean);
                      return (
                        <ul key={idx} className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs">
                          {items.map((it, iIdx) => (
                            <li key={iIdx}>{it.replace(/^[-*]\s+/, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    if (/^\d+\.\s/.test(trimmed)) {
                      const items = trimmed.split('\n').filter(Boolean);
                      return (
                        <ol key={idx} className="list-decimal pl-5 space-y-1.5 text-slate-300 text-xs">
                          {items.map((it, iIdx) => (
                            <li key={iIdx}>{it.replace(/^\d+\.\s+/, '')}</li>
                          ))}
                        </ol>
                      );
                    }
                    return (
                      <p key={idx} className="text-slate-300 text-xs leading-relaxed">
                        {trimmed}
                      </p>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Empty State for Report */
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-200">
                {isActive ? 'Synthesis Report In Progress' : 'No Report Available'}
              </h4>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {isActive
                  ? 'Research agents are still collecting data and executing fact verification. The finalized synthesized document will appear here upon completion.'
                  : 'A finalized synthesis report was not generated for this pipeline run.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: CLAIMS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Fact-Checked Claims</h3>
              <p className="text-xs text-slate-500">
                Cross-referenced factual assertions evaluated by the verification crew
              </p>
            </div>

            {claims.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                {(['all', 'verified', 'disputed', 'unverified'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setClaimFilter(f)}
                    className={`px-2.5 py-1 rounded capitalize transition-colors ${
                      claimFilter === f
                        ? 'bg-slate-800 text-white font-medium shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoadingClaims ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Verifying claims from sources...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
              <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-200">
                {isActive ? 'Fact-Checking Underway' : 'No Claims Verified'}
              </h4>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                {isActive
                  ? 'The fact-checking agent extracts statements from sources once scraping is complete.'
                  : 'No claims records were found for this research job.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClaims.map((claim, idx) => {
                const verdict = (claim.verdict || 'unverified').toLowerCase();
                const isSupported = verdict === 'verified';
                const isRefuted = verdict === 'disputed';

                return (
                  <div
                    key={claim.id || idx}
                    className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {isSupported ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : isRefuted ? (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-100 leading-relaxed">
                            {claim.claim_text}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${
                            isSupported
                              ? 'text-emerald-400'
                              : isRefuted
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {verdict.replace('_', ' ')}
                        </span>
                        {claim.confidence !== undefined && (
                          <p className="text-[10px] font-mono text-slate-400 tabular-nums">
                            {Math.round(claim.confidence * 100)}% confidence
                          </p>
                        )}
                      </div>
                    </div>

                    {claim.quote && (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                        <span className="text-[11px] font-medium text-slate-400 block mb-1">
                          Evaluated Evidence:
                        </span>
                        <p className="leading-relaxed">{claim.quote}</p>
                      </div>
                    )}

                    {claim.source_url && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Attributed Source:</span>
                        <a
                          href={claim.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1 truncate max-w-md"
                        >
                          <span className="truncate">{claim.source_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SOURCES */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Ingested Research Sources</h3>
            <p className="text-xs text-slate-500">
              Documents, arXiv papers, and web literature analyzed by the scraper agent
            </p>
          </div>

          {isLoadingSources ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Ingesting and parsing research literature...</p>
            </div>
          ) : sources.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-200">
                {isActive ? 'Ingestion In Progress' : 'No Sources Found'}
              </h4>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                {isActive
                  ? 'The scraper agent is querying search providers and extracting full texts.'
                  : 'No ingested sources records are associated with this pipeline job.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((src, idx) => (
                <div
                  key={src.id || idx}
                  className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-100 flex-1 leading-snug">
                      {src.title || 'Untitled Document / Research Node'}
                    </h4>

                    {src.status && (
                      <span className="text-[11px] font-mono text-indigo-400 tabular-nums shrink-0">
                        {src.status}
                      </span>
                    )}
                  </div>

                  {src.word_count !== undefined && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {src.word_count.toLocaleString()} words extracted
                    </p>
                  )}

                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-sm">{src.url}</span>
                    </div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal before cancelling */}
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        title="Cancel Active Research Job?"
        message="Are you sure you want to cancel this pipeline job? Scraping and synthesis tasks currently underway will be halted. You can resume it later if needed."
        confirmLabel="Yes, Cancel Job"
        confirmVariant="danger"
        isLoading={isActionLoading}
        onConfirm={handleCancelJob}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
};
