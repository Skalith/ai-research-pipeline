import { AuthResponse } from '../types';

// Centralized API configuration
const getInitialBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // Check localStorage for user-configured base URL override if any
  try {
    const stored = localStorage.getItem('pipeline_api_base_url');
    if (stored) return stored.trim().replace(/\/+$/, '');
  } catch {}
  return '';
};

let currentBaseUrl = getInitialBaseUrl();

// In-memory access token (lost on full refresh if not restored via sessionStorage refresh token)
let inMemoryAccessToken: string | null = null;
let onAuthFailureCallback: (() => void) | null = null;

export const getActiveBaseUrl = () => currentBaseUrl;

export const setCustomBaseUrl = (url: string) => {
  currentBaseUrl = url.trim().replace(/\/+$/, '');
  try {
    if (currentBaseUrl) {
      localStorage.setItem('pipeline_api_base_url', currentBaseUrl);
    } else {
      localStorage.removeItem('pipeline_api_base_url');
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('pipeline_base_url_change', { detail: { url: currentBaseUrl } }));
};

export const getApiPrefix = (): string => {
  return currentBaseUrl ? `${currentBaseUrl}/api/v1` : '/api/v1';
};

// Access token management in memory
export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

// Refresh token in sessionStorage as requested
const REFRESH_TOKEN_KEY = 'pipeline_refresh_token';

export const getStoredRefreshToken = (): string | null => {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredRefreshToken = (token: string | null) => {
  try {
    if (token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {}
};

export const setOnAuthFailure = (callback: () => void) => {
  onAuthFailureCallback = callback;
};

// API Error class supporting FastAPI `detail` messages
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    let message = 'API Request Failed';
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    } else if (detail && typeof detail === 'object' && 'message' in detail) {
      message = String((detail as any).message);
    } else if (detail) {
      message = JSON.stringify(detail);
    }
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// Mutex promise to prevent concurrent refresh calls
let refreshPromise: Promise<string | null> | null = null;

async function executeRefreshToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const url = `${getApiPrefix()}/auth/refresh`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data: AuthResponse = await response.json();
    setAccessToken(data.access_token);
    if (data.refresh_token) {
      setStoredRefreshToken(data.refresh_token);
    }
    return data.access_token;
  } catch (err) {
    // If refresh fails, clear session and return to signin
    setAccessToken(null);
    setStoredRefreshToken(null);
    if (onAuthFailureCallback) {
      onAuthFailureCallback();
    }
    return null;
  }
}

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  skipRefreshRetry?: boolean;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, skipRefreshRetry = false, headers = {}, ...customConfig } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${getApiPrefix()}${endpoint}`;
  const reqHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!(customConfig.body instanceof FormData) && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  if (requiresAuth && inMemoryAccessToken) {
    reqHeaders['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(url, {
    ...customConfig,
    headers: reqHeaders,
  });

  if (response.status === 401 && requiresAuth && !skipRefreshRetry) {
    // Refresh token once and retry
    if (!refreshPromise) {
      refreshPromise = executeRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;
    if (newAccessToken) {
      // Retry the original request once with the new access token
      const retryHeaders = {
        ...reqHeaders,
        Authorization: `Bearer ${newAccessToken}`,
      };
      const retryResponse = await fetch(url, {
        ...customConfig,
        headers: retryHeaders,
      });

      if (!retryResponse.ok) {
        const errData = await parseErrorResponse(retryResponse);
        throw new ApiError(retryResponse.status, errData);
      }

      if (retryResponse.status === 204) {
        return undefined as unknown as T;
      }
      return await retryResponse.json();
    } else {
      throw new ApiError(401, 'Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const errData = await parseErrorResponse(response);
    throw new ApiError(response.status, errData);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return await response.json();
}

async function parseErrorResponse(response: Response): Promise<unknown> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      return json.detail ?? json.message ?? json;
    }
    const text = await response.text();
    return text || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

// Download authenticated file as Blob helper (PDF/DOCX/Markdown)
export async function downloadAuthenticatedFile(
  endpoint: string,
  suggestedFilename: string
): Promise<void> {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiPrefix()}${endpoint}`;
  const headers: Record<string, string> = {};
  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const err = await parseErrorResponse(response);
    throw new ApiError(response.status, err);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, suggestedFilename);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}

// Authenticated SSE reader using fetch
export async function streamJobProgress(
  jobId: string,
  onEvent: (data: { job_id: string; status: string; stage: string; progress: number }) => void,
  onError: (error: Error) => void,
  signal?: AbortSignal
): Promise<() => void> {
  const controller = new AbortController();
  const activeSignal = signal || controller.signal;

  let isClosed = false;

  const runStream = async () => {
    try {
      const url = `${getApiPrefix()}/research/jobs/${encodeURIComponent(jobId)}/progress`;
      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
      };
      if (inMemoryAccessToken) {
        headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: activeSignal,
      });

      if (!response.ok) {
        const errText = await parseErrorResponse(response);
        throw new ApiError(response.status, errText);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!isClosed) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const eventData = JSON.parse(jsonStr);
                if (eventData && typeof eventData === 'object') {
                  onEvent(eventData);

                  // Stop tracking at completed, failed, or cancelled
                  if (
                    eventData.status === 'completed' ||
                    eventData.status === 'failed' ||
                    eventData.status === 'cancelled'
                  ) {
                    isClosed = true;
                    return;
                  }
                }
              } catch (parseErr) {
                console.warn('Failed to parse SSE JSON chunk:', jsonStr);
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (!isClosed && err.name !== 'AbortError') {
        onError(err);
      }
    }
  };

  runStream();

  return () => {
    isClosed = true;
    controller.abort();
  };
}
