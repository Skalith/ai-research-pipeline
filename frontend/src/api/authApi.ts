import { AuthResponse, User } from '../types';
import { apiClient, setAccessToken, setStoredRefreshToken } from './client';

export interface AuthCredentials {
  email: string;
  password: string;
}

export const authApi = {
  async signup(credentials: AuthCredentials): Promise<AuthResponse> {
    const res = await apiClient<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(credentials),
      requiresAuth: false,
    });
    setAccessToken(res.access_token);
    if (res.refresh_token) {
      setStoredRefreshToken(res.refresh_token);
    }
    return res;
  },

  async signin(credentials: AuthCredentials): Promise<AuthResponse> {
    const res = await apiClient<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
      requiresAuth: false,
    });
    setAccessToken(res.access_token);
    if (res.refresh_token) {
      setStoredRefreshToken(res.refresh_token);
    }
    return res;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const res = await apiClient<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
      requiresAuth: false,
      skipRefreshRetry: true,
    });
    setAccessToken(res.access_token);
    if (res.refresh_token) {
      setStoredRefreshToken(res.refresh_token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiClient('/auth/logout', {
        method: 'POST',
        requiresAuth: true,
        skipRefreshRetry: true,
      });
    } catch {
      // Prompt: Signout calls POST /auth/logout with the access token, then clears local tokens and returns to signin even if the request fails.
    } finally {
      setAccessToken(null);
      setStoredRefreshToken(null);
    }
  },

  async getMe(): Promise<User> {
    return apiClient<User>('/auth/me', {
      method: 'GET',
      requiresAuth: true,
    });
  },
};
