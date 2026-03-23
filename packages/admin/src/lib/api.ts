'use client';

/**
 * NovEx Admin API client — wired to the real NestJS backend.
 *
 * Backend endpoints currently available:
 *   POST /auth/login        -> { user, tokens }
 *   POST /auth/logout       -> { message }
 *   GET  /market/pairs      -> TradingPairDto[]
 *   GET  /wallets/balances   -> BalanceDto[]
 *   GET  /notifications      -> Notification[]
 *
 * TODO: Backend endpoints needed for admin:
 *   GET  /admin/metrics      -> DashboardMetrics
 *   GET  /admin/users        -> PaginatedResponse<AdminUser>
 *   GET  /admin/audit-logs   -> PaginatedResponse<AuditLogEntry>
 */

import type {
  AdminUser,
  Announcement,
  AuditLogEntry,
  AuditLogFilters,
  DashboardMetrics,
  Deposit,
  KycSubmission,
  Order,
  PaginatedResponse,
  TradingPair,
  UserBalance,
  UserFilters,
  UserLoginHistory,
  Withdrawal,
  WithdrawalFilters,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/* ─── Response types (matching backend shapes) ─────────── */

export interface AuthResponse {
  user: { id: string; email: string; role: string };
  tokens: { accessToken: string; refreshToken: string };
}

export interface TradingPairDto {
  id: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: string;
  makerFee: string;
  takerFee: string;
  isActive: boolean;
}

export interface BalanceDto {
  currency: string;
  available: string;
  locked: string;
  total: string;
}

/* ─── Token management ─────────────────────────────────── */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('novex_admin_access_token', access);
    localStorage.setItem('novex_admin_refresh_token', refresh);
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('novex_admin_access_token');
    refreshToken = localStorage.getItem('novex_admin_refresh_token');
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('novex_admin_access_token');
    localStorage.removeItem('novex_admin_refresh_token');
    localStorage.removeItem('novex-admin-auth');
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem('novex_admin_access_token');
  }
  return accessToken;
}

/* ─── Token refresh ────────────────────────────────────── */

let refreshInProgress: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      const currentRefresh = typeof window !== 'undefined'
        ? localStorage.getItem('novex_admin_refresh_token')
        : null;

      if (!currentRefresh || !accessToken) return false;

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken: currentRefresh }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.accessToken && data.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

/* ─── Core fetch wrapper ───────────────────────────────── */

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  opts?: { skipAuth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token && !opts?.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token refresh on 401
  if (res.status === 401 && !opts?.skipAuth) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${getAccessToken()}` };
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        method, headers: retryHeaders, body: body ? JSON.stringify(body) : undefined,
      });
      if (retryRes.ok) {
        return retryRes.json() as Promise<T>;
      }
    }
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (res.status === 403) {
    const data403 = await res.json().catch(() => null);
    throw new Error(data403?.message ?? 'Access denied');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

/* ─── Auth ─────────────────────────────────────────────── */

export const authApi = {
  login(email: string, password: string) {
    return request<AuthResponse>('POST', '/auth/login', {
      email, password,
    }, { skipAuth: true });
  },

  logout() {
    return request<{ message: string }>('POST', '/auth/logout').catch(() => {
      // Best-effort — clear tokens even if server unreachable
    });
  },
};

/* ─── Market / Trading Pairs ──────────────────────────── */

export const marketApi = {
  /** GET /market/pairs — real backend endpoint */
  getPairs() {
    return request<TradingPairDto[]>('GET', '/market/pairs');
  },
};

/* ─── Wallets ──────────────────────────────────────────── */

export const walletApi = {
  /** GET /wallets/balances — real backend endpoint (admin view) */
  getBalances() {
    return request<BalanceDto[]>('GET', '/wallets/balances');
  },
};

/* ─── Notifications ────────────────────────────────────── */

export const notificationsApi = {
  /** GET /notifications — real backend endpoint */
  getAll() {
    return request<unknown[]>('GET', '/notifications');
  },
};

/* ─── Admin-specific endpoints ─────────────────────────── */
/* TODO: These endpoints need to be built in the backend    */

export const adminApi = {
  /** TODO: GET /admin/metrics — backend endpoint needed */
  getMetrics() {
    return request<DashboardMetrics>('GET', '/admin/metrics');
  },

  /** TODO: GET /admin/users — backend endpoint needed */
  getUsers(filters?: UserFilters) {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.kycTier) params.set("kycTier", filters.kycTier);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    if (filters?.sortBy) params.set("sortBy", filters.sortBy);
    if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);
    const qs = params.toString();
    return request<PaginatedResponse<AdminUser>>(`GET`, `/admin/users${qs ? `?${qs}` : ""}`);
  },

  /** TODO: GET /admin/audit-logs — backend endpoint needed */
  getAuditLogs(filters?: AuditLogFilters) {
    const params = new URLSearchParams();
    if (filters?.actor) params.set("actor", filters.actor);
    if (filters?.action) params.set("action", filters.action);
    if (filters?.resourceType) params.set("resourceType", filters.resourceType);
    if (filters?.startDate) params.set("startDate", filters.startDate);
    if (filters?.endDate) params.set("endDate", filters.endDate);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    const qs = params.toString();
    return request<PaginatedResponse<AuditLogEntry>>(`GET`, `/admin/audit${qs ? `?${qs}` : ""}`);
  },

  // ─── Users (individual) ─────────────────────────────────
  getUserById(id: string) {
    return request<AdminUser>('GET', `/admin/users/${id}`);
  },

  getUserBalances(id: string) {
    return request<UserBalance[]>('GET', `/admin/users/${id}/balances`);
  },

  getUserOrders(id: string) {
    return request<Order[]>('GET', `/admin/users/${id}/orders`);
  },

  getUserDeposits(id: string) {
    return request<Deposit[]>('GET', `/admin/users/${id}/deposits`);
  },

  getUserWithdrawals(id: string) {
    return request<Withdrawal[]>('GET', `/admin/users/${id}/withdrawals`);
  },

  getUserLoginHistory(id: string) {
    return request<UserLoginHistory[]>('GET', `/admin/users/${id}/login-history`);
  },

  freezeUser(id: string, reason: string) {
    return request<void>('POST', `/admin/users/${id}/freeze`, { reason });
  },

  unfreezeUser(id: string) {
    return request<void>('POST', `/admin/users/${id}/unfreeze`);
  },

  // ─── KYC ────────────────────────────────────────────────
  getKycQueue() {
    return request<PaginatedResponse<KycSubmission>>('GET', '/admin/kyc/queue');
  },

  approveKyc(id: string, notes?: string) {
    return request<void>('POST', `/admin/kyc/${id}/approve`, { notes });
  },

  rejectKyc(id: string, reason: string) {
    return request<void>('POST', `/admin/kyc/${id}/reject`, { reason });
  },

  // ─── Withdrawals ────────────────────────────────────────
  getWithdrawals(filters?: WithdrawalFilters) {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.asset) params.set("asset", filters.asset);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    const qs = params.toString();
    return request<PaginatedResponse<Withdrawal>>('GET', `/admin/withdrawals${qs ? `?${qs}` : ""}`);
  },

  approveWithdrawal(id: string, notes?: string) {
    return request<void>('POST', `/admin/withdrawals/${id}/approve`, { notes });
  },

  rejectWithdrawal(id: string, reason: string) {
    return request<void>('POST', `/admin/withdrawals/${id}/reject`, { reason });
  },

  // ─── Trading Pairs ──────────────────────────────────────
  createTradingPair(pair: Omit<TradingPair, "id" | "createdAt" | "lastPrice" | "volume24h">) {
    return request<TradingPair>('POST', '/admin/pairs', pair as unknown as Record<string, unknown>);
  },

  updateTradingPair(id: string, updates: Partial<TradingPair>) {
    return request<TradingPair>('PATCH', `/admin/pairs/${id}`, updates as unknown as Record<string, unknown>);
  },

  // ─── Announcements ──────────────────────────────────────
  getAnnouncements() {
    return request<Announcement[]>('GET', '/admin/announcements');
  },

  createAnnouncement(data: Omit<Announcement, "id" | "createdAt" | "updatedAt" | "createdBy">) {
    return request<Announcement>('POST', '/admin/announcements', data as unknown as Record<string, unknown>);
  },

  updateAnnouncement(id: string, data: Partial<Announcement>) {
    return request<Announcement>('PATCH', `/admin/announcements/${id}`, data as unknown as Record<string, unknown>);
  },

  deleteAnnouncement(id: string) {
    return request<void>('DELETE', `/admin/announcements/${id}`);
  },
};

export default adminApi;
