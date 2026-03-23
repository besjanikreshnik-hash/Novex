'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setTokens, clearTokens, loadTokens } from '@/lib/api';

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

  /** Initialize from persisted state — call once on app load */
  initialize: () => void;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      initialize() {
        loadTokens();
        const { user } = get();
        if (user) {
          set({ isAuthenticated: true });
        }
      },

      async login(email, password) {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login(email, password);
          setTokens(res.tokens.accessToken, res.tokens.refreshToken);
          set({
            user: res.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          });
          throw err;
        }
      },

      async logout() {
        try {
          await authApi.logout();
        } finally {
          clearTokens();
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      clearError() {
        set({ error: null });
      },
    }),
    {
      name: 'novex-admin-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
