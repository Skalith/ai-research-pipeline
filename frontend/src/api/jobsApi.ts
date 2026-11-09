import { Claim, ResearchJob, Source, StoredJobMeta } from '../types';
import { apiClient, streamJobProgress } from './client';

const RECENT_JOBS_STORAGE_KEY = 'pipeline_recent_jobs_v1';

export interface CreateJobPayload {
  query: string;
  urls?: string[];
  idempotency_key: string;
}

export const jobsApi = {
  async createJob(payload: CreateJobPayload): Promise<ResearchJob> {
    const res = await apiClient<ResearchJob>('/research/jobs', {
      method: 'POST',
      body: JSON.stringify({
        query: payload.query,
        urls: payload.urls || [],
        idempotency_key: payload.idempotency_key,
      }),
      headers: {
        'Idempotency-Key': payload.idempotency_key,
      },
    });

    // Save locally
    jobsApi.saveRecentJob({
      id: res.id,
      query: res.query || payload.query,
      createdAt: res.created_at || new Date().toISOString(),
      status: res.status,
      stage: res.stage,
      progress: res.progress,
    });

    return res;
  },

  async getJob(jobId: string): Promise<ResearchJob> {
    const job = await apiClient<ResearchJob>(`/research/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    // Update locally stored meta if present
    jobsApi.updateStoredJob(job);

    return job;
  },

  async cancelJob(jobId: string): Promise<ResearchJob> {
    const job = await apiClient<ResearchJob>(`/research/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
    });
    jobsApi.updateStoredJob(job);
    return job;
  },

  async resumeJob(jobId: string): Promise<ResearchJob> {
    const job = await apiClient<ResearchJob>(`/research/jobs/${encodeURIComponent(jobId)}/resume`, {
      method: 'POST',
    });
    jobsApi.updateStoredJob(job);
    return job;
  },

  async getSources(jobId: string): Promise<Source[]> {
    return apiClient<Source[]>(`/research/jobs/${encodeURIComponent(jobId)}/sources`, {
      method: 'GET',
    });
  },

  async getClaims(jobId: string): Promise<Claim[]> {
    return apiClient<Claim[]>(`/research/jobs/${encodeURIComponent(jobId)}/claims`, {
      method: 'GET',
    });
  },

  subscribeToProgress: streamJobProgress,

  // Local Storage management for browser recent jobs
  getStoredRecentJobs(): StoredJobMeta[] {
    try {
      const data = localStorage.getItem(RECENT_JOBS_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveRecentJob(jobMeta: StoredJobMeta): void {
    try {
      const existing = jobsApi.getStoredRecentJobs();
      const filtered = existing.filter(j => j.id !== jobMeta.id);
      const updated = [jobMeta, ...filtered].slice(0, 50); // Keep last 50
      localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  updateStoredJob(job: ResearchJob): void {
    try {
      const existing = jobsApi.getStoredRecentJobs();
      const index = existing.findIndex(j => j.id === job.id);
      if (index !== -1) {
        existing[index] = {
          ...existing[index],
          query: job.query || existing[index].query,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
        };
        localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch {}
  },

  removeStoredJob(jobId: string): void {
    try {
      const existing = jobsApi.getStoredRecentJobs();
      const filtered = existing.filter(j => j.id !== jobId);
      localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  },
};
