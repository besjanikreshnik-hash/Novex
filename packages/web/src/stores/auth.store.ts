'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setTokens, clearTokens, loadTokens, is2FAPending, isAuthResponse } from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  /** 2FA pending state */
  requires2FA: boolean;
  tempToken: string | null;

  /** Initialize from persisted state — call once on app load */
  initialize: () => void;

  login: (email: string, password: string) => Promise<{ requires2FA: boolean }>;
  complete2FALogin: (code: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clear2FA: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requires2FA: false,
      tempToken: null,

      initialize() {
        loadTokens();
        const { user } = get();
        if (user) {
          set({ isAuthenticated: true });
        }
      },

      async login(email, password) {
        set({ isLoading: true, error: null, requires2FA: false, tempToken: null });
        try {
          const res = await authApi.login(email, password);

          if (is2FAPending(res)) {
            set({
              requires2FA: true,
              tempToken: res.tempToken,
              isLoading: false,
            });
            return { requires2FA: true };
          }

          if (isAuthResponse(res)) {
            setTokens(res.tokens.accessToken, res.tokens.refreshToken);
            set({
              user: res.user,
              isAuthenticated: true,
              isLoading: false,
            });
          }

          return { requires2FA: false };
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          });
          throw err;
        }
      },

      async complete2FALogin(code) {
        const { tempToken } = get();
        if (!tempToken) {
          set({ error: 'No pending 2FA session. Please login again.' });
          throw new Error('No pending 2FA session');
        }

        set({ isLoading: true, error: null });
        try {
          const res = await authApi.complete2FALogin(tempToken, code);
          setTokens(res.tokens.accessToken, res.tokens.refreshToken);
          set({
            user: res.user,
            isAuthenticated: true,
            isLoading: false,
            requires2FA: false,
            tempToken: null,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Invalid 2FA code',
          });
          throw err;
        }
      },

      async register(email, password, firstName, lastName) {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register(email, password, firstName, lastName);
          setTokens(res.tokens.accessToken, res.tokens.refreshToken);
          set({
            user: res.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Registration failed',
          });
          throw err;
        }
      },

      async logout() {
        try {
          await authApi.logout();
        } finally {
          clearTokens();
          set({ user: null, isAuthenticated: false, error: null, requires2FA: false, tempToken: null });
        }
      },

      clearError() {
        set({ error: null });
      },

      clear2FA() {
        set({ requires2FA: false, tempToken: null });
      },
    }),
    {
      name: 'novex-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
