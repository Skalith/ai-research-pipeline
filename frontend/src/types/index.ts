export type UserRole = 'researcher' | 'viewer' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export type JobStatus = 'pending' | 'running' | 'scraping' | 'summarizing' | 'fact_checking' | 'writing' | 'editing' | 'completed' | 'failed' | 'cancelled' | string;

export interface ResearchJob {
  id: string;
  query: string;
  status: JobStatus;
  stage?: string;
  progress?: number;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  urls?: string[];
  user_id?: string;
}

export interface JobProgressEvent {
  job_id: string;
  status: string;
  stage: string;
  progress: number;
}

export interface Source {
  id: string;
  job_id?: string;
  url: string;
  title?: string;
  status?: string;
  word_count?: number;
  content_hash?: string;
  error?: string;
  created_at?: string;
}

export interface Claim {
  id: string;
  job_id?: string;
  claim_text: string;
  verdict?: 'verified' | 'disputed' | 'unverified' | string;
  confidence?: number;
  quote?: string;
  reason?: string;
  source_url?: string;
  created_at?: string;
}

export interface Report {
  id?: string;
  job_id: string;
  title?: string;
  executive_summary?: string;
  markdown?: string;
  pdf_path?: string;
  docx_path?: string;
  created_at?: string;
}

export interface AdminProvider {
  name: string;
  type?: string;
  enabled: boolean;
  available: boolean;
  has_key: boolean;
}

export interface AdminProviderTestResult {
  provider: string;
  status: string;
  latency_ms?: number;
  message?: string;
}

export interface AdminUsage {
  total_jobs?: number;
  active_jobs?: number;
  total_tokens?: number;
  completed_jobs?: number;
  failed_jobs?: number;
  jobs_by_status?: Record<string, number>;
  total_claims?: number;
  total_sources?: number;
  cost_estimate_usd?: number;
  [key: string]: unknown;
}

export interface StoredJobMeta {
  id: string;
  query: string;
  createdAt: string;
  status?: string;
  stage?: string;
  progress?: number;
}
