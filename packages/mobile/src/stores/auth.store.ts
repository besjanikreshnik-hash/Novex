import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, AuthTokens } from '../types';

const TOKEN_KEY = 'novex_auth_tokens';
const USER_KEY = 'novex_auth_user';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  setAuth: (user: User, tokens: AuthTokens) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const [storedTokens, storedUser] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (storedTokens) {
        const tokens: AuthTokens = JSON.parse(storedTokens);
        const user: User | null = storedUser ? JSON.parse(storedUser) : null;
        set({ tokens, user, isAuthenticated: true, isLoading: false, isInitialized: true });
      } else {
        set({ isLoading: false, isInitialized: true });
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
      set({ isLoading: false, isInitialized: true });
    }
  },

  setAuth: async (user, tokens) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens)),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ user, tokens, isAuthenticated: true });
  },

  setUser: (user) => {
    set({ user });
    // Persist user update
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
  },

  logout: async () => {
    // Call backend logout endpoint (best-effort)
    const token = get().tokens?.accessToken;
    if (token) {
      try {
        const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';
        await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // Ignore network errors during logout
      }
    }

    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {}),
    ]);
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  getAccessToken: () => get().tokens?.accessToken ?? null,

  getRefreshToken: () => get().tokens?.refreshToken ?? null,
}));
