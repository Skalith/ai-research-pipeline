import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  ExternalLink,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2
} from 'lucide-react';
import { jobsApi } from '../api/jobsApi';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ResearchJob, StoredJobMeta } from '../types';

interface DashboardPageProps {
  onOpenNewJob: () => void;
  onOpenJobWorkspace: (jobId: string) => void;
}

interface EnrichedJobItem {
  id: string;
  query: string;
  createdAt: string;
  status: string;
  stage?: string;
  progress?: number;
  error?: string | null;
  isInaccessible?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenNewJob,
  onOpenJobWorkspace,
}) => {
  const { user, role } = useAuth();
  const { notify } = useNotification();
  const isResearcher = role === 'researcher' || role === 'admin';

  const [jobs, setJobs] = useState<EnrichedJobItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Load and enrich recent jobs from localStorage + GET /research/jobs/{job_id}
  const loadRecentJobs = async () => {
    const stored = jobsApi.getStoredRecentJobs();
    if (stored.length === 0) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    // Set initial stored snapshot
    const initialList: EnrichedJobItem[] = stored.map(s => ({
      id: s.id,
      query: s.query,
      createdAt: s.createdAt,
      status: s.status || 'pending',
      stage: s.stage,
      progress: s.progress,
    }));
    setJobs(initialList);

    // Fetch latest live states with GET /research/jobs/{job_id}
    const updatedList = await Promise.all(
      stored.map(async item => {
        try {
          const liveJob: ResearchJob = await jobsApi.getJob(item.id);
          return {
            id: liveJob.id,
            query: liveJob.query || item.query,
            createdAt: liveJob.created_at || item.createdAt,
            status: liveJob.status,
            stage: liveJob.stage,
            progress: liveJob.progress,
            error: liveJob.error,
            isInaccessible: false,
          };
        } catch (err: any) {
          // If job was deleted or inaccessible, handle gracefully
          return {
            id: item.id,
            query: item.query,
            createdAt: item.createdAt,
            status: 'unknown',
            error: err.message || 'Job inaccessible or deleted',
            isInaccessible: true,
          };
        }
      })
    );

    setJobs(updatedList);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRecentJobs();
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadRecentJobs();
    notify('info', 'Refreshed research job states');
  };

  const handleRemoveStoredJob = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    jobsApi.removeStoredJob(jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    notify('info', `Removed ${jobId} from local browser list`);
  };

  const filteredJobs = jobs.filter(j =>
    j.query.toLowerCase().includes(searchFilter.toLowerCase()) ||
    j.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Research Portal</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{role} Privileges</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-100">
            Multi-Agent Research Pipeline
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl leading-relaxed">
            Autonomous multi-agent synthesis with live fact-checking, claims verification, and exportable intelligence reports.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
            title="Refresh latest job states from backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>

          {/* Prominent "New research job" action for researchers (hidden for viewers) */}
          {isResearcher && (
            <button
              onClick={onOpenNewJob}
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New research job</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Summary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
          <p className="text-[11px] sm:text-xs text-slate-400">Total Recent Jobs</p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-100 font-mono tabular-nums">
            {jobs.length}
          </p>
        </div>
        <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
          <p className="text-[11px] sm:text-xs text-slate-400">Completed Reports</p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {jobs.filter(j => j.status === 'completed').length}
          </p>
        </div>
        <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
          <p className="text-[11px] sm:text-xs text-slate-400">Active Pipelines</p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-indigo-400 font-mono tabular-nums">
            {jobs.filter(j => j.status === 'running' || j.status === 'pending' || j.status === 'processing').length}
          </p>
        </div>
        <div className="p-3 sm:p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl">
          <p className="text-[11px] sm:text-xs text-slate-400">Failed / Cancelled</p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-rose-400 font-mono tabular-nums">
            {jobs.filter(j => j.status === 'failed' || j.status === 'cancelled').length}
          </p>
        </div>
      </div>

      {/* Recent Jobs Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100 tracking-tight">
              Recent Research Jobs
            </h3>
            <p className="text-xs text-slate-500">
              Jobs tracked in this browser session and synced via <span className="font-mono text-slate-400">GET /research/jobs/{'{job_id}'}</span>
            </p>
          </div>

          {jobs.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Filter by query or ID..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Loading State Skeleton */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-20 bg-slate-900/60 border border-slate-800/80 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800/60 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">
              {searchFilter ? 'No matching research jobs found' : 'No research jobs created yet'}
            </h4>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {searchFilter
                ? 'Try clearing the search filter to see all jobs.'
                : isResearcher
                ? 'Launch an autonomous research job by entering your research query and optional seed URLs.'
                : 'As a viewer, you have read-only access. Created jobs will appear here when tracked in your session.'}
            </p>
            {isResearcher && !searchFilter && (
              <div className="mt-6">
                <button
                  onClick={onOpenNewJob}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Start First Research Job</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Jobs List */
          <div className="space-y-3">
            {filteredJobs.map(job => (
              <div
                key={job.id}
                onClick={() => onOpenJobWorkspace(job.id)}
                className="group relative p-4 bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                      <span className="font-mono text-slate-400">{job.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {job.stage && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">Stage: {job.stage.replace('_', ' ')}</span>
                        </>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {job.query}
                    </h4>

                    {job.error && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{job.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Status, Progress & Actions */}
                  <div className="flex items-center gap-4 shrink-0 sm:self-center">
                    {/* Progress Bar (if running or has progress) */}
                    {job.progress !== undefined && (
                      <div className="hidden md:flex flex-col items-end gap-1 w-24">
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {job.progress}%
                        </span>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="w-28 text-right">
                      {job.isInaccessible ? (
                        <span className="text-xs text-rose-400">Inaccessible</span>
                      ) : (
                        <StatusIndicator status={job.status} stage={job.stage} />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {job.isInaccessible && (
                        <button
                          onClick={e => handleRemoveStoredJob(e, job.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800"
                          title="Remove from local list"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="p-1.5 text-slate-400 group-hover:text-indigo-400 rounded-md transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
