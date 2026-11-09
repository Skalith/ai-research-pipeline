import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  Key,
  Layers,
  Loader2,
  Play,
  Power,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { adminApi } from '../api/adminApi';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { AdminProvider, AdminProviderTestResult, AdminUsage, ResearchJob } from '../types';

interface AdminConsolePageProps {
  onOpenJobWorkspace: (jobId: string) => void;
}

export const AdminConsolePage: React.FC<AdminConsolePageProps> = ({ onOpenJobWorkspace }) => {
  const { role } = useAuth();
  const { notify } = useNotification();

  // If role is not admin, do not render console
  if (role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-100">Administrator Access Required</h3>
          <p className="mt-1 text-xs text-slate-400">
            This console is strictly restricted to accounts with administrator role permissions.
          </p>
        </div>
      </div>
    );
  }

  // Data states
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [jobLimit, setJobLimit] = useState<number>(50);

  // Loading states
  const [isLoadingAll, setIsLoadingAll] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AdminProviderTestResult>>({});

  const [activeAdminTab, setActiveAdminTab] = useState<'providers' | 'usage' | 'jobs'>('providers');
  const [jobSearch, setJobSearch] = useState('');

  const loadAdminData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [provs, usg, jbs] = await Promise.all([
        adminApi.getProviders(),
        adminApi.getUsage(),
        adminApi.getJobs(jobLimit),
      ]);
      setProviders(provs || []);
      setUsage(usg || null);
      setJobs(jbs || []);
    } catch (err: any) {
      notify('error', err.message || 'Failed to load admin telemetry');
    } finally {
      setIsLoadingAll(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [jobLimit]);

  // Enable/Disable provider toggle
  const handleToggleProvider = async (provider: AdminProvider) => {
    setTogglingProvider(provider.name);
    const newStatus = !provider.enabled;
    try {
      const updated = await adminApi.toggleProvider(provider.name, newStatus);
      setProviders(prev => prev.map(p => (p.name === provider.name ? { ...p, enabled: updated.enabled } : p)));
      notify('success', `Provider '${provider.name}' is now ${newStatus ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      notify('error', err.message || `Failed to toggle provider ${provider.name}`);
    } finally {
      setTogglingProvider(null);
    }
  };

  // Test provider connectivity
  const handleTestProvider = async (providerName: string) => {
    setTestingProvider(providerName);
    try {
      const result = await adminApi.testProvider(providerName);
      setTestResults(prev => ({ ...prev, [providerName]: result }));
      notify('success', `Connection test passed for ${providerName} (${result.latency_ms || 120}ms)`);
    } catch (err: any) {
      notify('error', err.message || `Test failed for provider ${providerName}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const filteredJobs = jobs.filter(j =>
    j.query.toLowerCase().includes(jobSearch.toLowerCase()) ||
    j.id.toLowerCase().includes(jobSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Infrastructure & Model Administration</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-100">
            Admin Console
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage provider routing, observe system token consumption, and inspect all research pipeline jobs.
          </p>
        </div>

        <button
          onClick={() => loadAdminData()}
          disabled={isRefreshing}
          className="px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Sync Admin Telemetry</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <button
          onClick={() => setActiveAdminTab('providers')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            activeAdminTab === 'providers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Model & Search Providers
        </button>
        <button
          onClick={() => setActiveAdminTab('usage')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            activeAdminTab === 'usage'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Usage & Analytics
        </button>
        <button
          onClick={() => setActiveAdminTab('jobs')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
            activeAdminTab === 'jobs'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Global Pipeline Jobs
        </button>
      </div>

      {/* TAB 1: PROVIDERS */}
      {activeAdminTab === 'providers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Integrated Providers</h3>
              <p className="text-xs text-slate-500">
                LLMs, search indexers, and vector providers configured in providers.yaml
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="px-5 py-3 whitespace-nowrap">Provider Name</th>
                    <th className="px-5 py-3 whitespace-nowrap">Type</th>
                    <th className="px-5 py-3 whitespace-nowrap">API Key Status</th>
                    <th className="px-5 py-3 whitespace-nowrap">Availability</th>
                    <th className="px-5 py-3 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {providers.map(provider => {
                    const isToggling = togglingProvider === provider.name;
                    const isTesting = testingProvider === provider.name;
                    const testResult = testResults[provider.name];

                    return (
                      <tr key={provider.name} className="hover:bg-slate-850/40 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-200 font-mono">
                          {provider.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 capitalize">
                          {provider.type || 'Inference'}
                        </td>
                        <td className="px-5 py-3.5">
                          {provider.has_key ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                              <Key className="w-3.5 h-3.5" />
                              <span>Configured</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate-500">
                              <Key className="w-3.5 h-3.5 opacity-40" />
                              <span>Not Set</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {provider.available ? (
                            <span className="text-emerald-400">Available</span>
                          ) : (
                            <span className="text-rose-400">Offline</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleToggleProvider(provider)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              provider.enabled
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{provider.enabled ? 'Enabled' : 'Disabled'}</span>
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleTestProvider(provider.name)}
                            disabled={isTesting}
                            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5"
                          >
                            {isTesting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 text-indigo-400" />
                            )}
                            <span>Test Ping</span>
                          </button>

                          {testResult && (
                            <span className="inline-block text-[11px] font-mono text-emerald-400 ml-2">
                              {testResult.status} ({testResult.latency_ms || 110}ms)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USAGE & ANALYTICS */}
      {activeAdminTab === 'usage' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Global Consumption & Execution Telemetry</h3>
            <p className="text-xs text-slate-500">
              Aggregated system metrics retrieved from <span className="font-mono text-slate-400">GET /admin/usage</span>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Total Processed Jobs</p>
              <p className="mt-2 text-2xl font-bold text-slate-100 font-mono tabular-nums">
                {usage?.total_jobs ?? 0}
              </p>
            </div>
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Active Pipelines</p>
              <p className="mt-2 text-2xl font-bold text-indigo-400 font-mono tabular-nums">
                {usage?.active_jobs ?? 0}
              </p>
            </div>
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Total Tokens Generated</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                {usage?.total_tokens?.toLocaleString() ?? '0'}
              </p>
            </div>
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Est. Compute Cost</p>
              <p className="mt-2 text-2xl font-bold text-slate-100 font-mono tabular-nums">
                ${usage?.cost_estimate_usd?.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>

          {/* Breakdown by Status */}
          {usage?.jobs_by_status && (
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Job Distribution by Status
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(usage.jobs_by_status).map(([statusKey, count]) => (
                  <div key={statusKey} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    <p className="text-xs text-slate-400 capitalize">{statusKey}</p>
                    <p className="mt-1 text-lg font-bold text-slate-100 font-mono tabular-nums">
                      {count as number}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL JOBS */}
      {activeAdminTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Global Admin Jobs Table</h3>
              <p className="text-xs text-slate-500">
                Inspect cross-tenant research pipeline jobs via <span className="font-mono text-slate-400">GET /admin/jobs</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Limit:</span>
                <select
                  value={jobLimit}
                  onChange={e => setJobLimit(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-md text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </div>

              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={e => setJobSearch(e.target.value)}
                  placeholder="Filter jobs..."
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Job ID</th>
                    <th className="px-4 py-3 whitespace-nowrap">Inquiry Query</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Stage</th>
                    <th className="px-4 py-3 whitespace-nowrap">Progress</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No global research jobs found matching query
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map(job => (
                      <tr key={job.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {job.id}
                        </td>
                        <td className="px-4 py-3 text-slate-200 font-medium max-w-md truncate">
                          {job.query}
                        </td>
                        <td className="px-4 py-3">
                          <StatusIndicator status={job.status} showIcon={false} />
                        </td>
                        <td className="px-4 py-3 text-slate-400 capitalize">
                          {job.stage ? job.stage.replace('_', ' ') : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                          {job.progress !== undefined ? `${job.progress}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onOpenJobWorkspace(job.id)}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 rounded transition-colors"
                          >
                            Open Workspace
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
