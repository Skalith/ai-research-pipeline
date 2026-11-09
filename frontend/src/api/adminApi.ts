import { AdminProvider, AdminProviderTestResult, AdminUsage, ResearchJob } from '../types';
import { apiClient } from './client';

export const adminApi = {
  async getProviders(): Promise<AdminProvider[]> {
    return apiClient<AdminProvider[]>('/admin/providers', {
      method: 'GET',
    });
  },

  async toggleProvider(name: string, enabled: boolean): Promise<AdminProvider> {
    return apiClient<AdminProvider>(`/admin/providers/${encodeURIComponent(name)}/toggle?enabled=${enabled}`, {
      method: 'POST',
    });
  },

  async testProvider(name: string): Promise<AdminProviderTestResult> {
    return apiClient<AdminProviderTestResult>(`/admin/providers/${encodeURIComponent(name)}/test`, {
      method: 'GET',
    });
  },

  async getUsage(): Promise<AdminUsage> {
    return apiClient<AdminUsage>('/admin/usage', {
      method: 'GET',
    });
  },

  async getJobs(limit: number = 50): Promise<ResearchJob[]> {
    const clampedLimit = Math.max(1, Math.min(1000, limit));
    return apiClient<ResearchJob[]>(`/admin/jobs?limit=${clampedLimit}`, {
      method: 'GET',
    });
  },
};
