import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, AuthCredentials } from '../api/authApi';
import {
  getStoredRefreshToken,
  setAccessToken,
  setOnAuthFailure,
  setStoredRefreshToken
} from '../api/client';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signin: (credentials: AuthCredentials) => Promise<void>;
  signup: (credentials: AuthCredentials) => Promise<void>;
  signout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setStoredRefreshToken(null);
  }, []);

  useEffect(() => {
    setOnAuthFailure(handleSessionExpired);
  }, [handleSessionExpired]);

  // On app load, use POST /auth/refresh when a refresh token exists, then call GET /auth/me to confirm session
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedRefresh = getStoredRefreshToken();
      if (!storedRefresh) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        // Refresh token call
        await authApi.refresh(storedRefresh);
        // Then call GET /auth/me to confirm the session
        const me = await authApi.getMe();
        if (isMounted) {
          setUser(me);
        }
      } catch (err) {
        // If refresh fails or me fails, clear the session and return to signin
        if (isMounted) {
          handleSessionExpired();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [handleSessionExpired]);

  const signin = async (credentials: AuthCredentials) => {
    const res = await authApi.signin(credentials);
    setUser(res.user);
  };

  const signup = async (credentials: AuthCredentials) => {
    const res = await authApi.signup(credentials);
    setUser(res.user);
  };

  const signout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
      setStoredRefreshToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : null,
        isAuthenticated: !!user,
        isLoading,
        signin,
        signup,
        signout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
