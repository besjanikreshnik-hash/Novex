'use client';

/**
 * NovEx API client — wired to the real NestJS backend.
 *
 * Backend endpoints:
 *   POST /auth/register   → { user, tokens }
 *   POST /auth/login      → { user, tokens }
 *   POST /auth/logout     → { message }
 *   GET  /market/pairs    → TradingPair[]
 *   GET  /market/ticker/:pair → TickerDto
 *   GET  /market/orderbook/:pair → OrderBookDto
 *   GET  /wallets/balances → BalanceDto[]
 *   POST /orders           → Order
 *   GET  /orders            → { orders, total }
 *   DELETE /orders/:id      → Order
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/* ─── Rate Limit Error ─────────────────────────────────── */

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/* ─── Response types (matching backend shapes) ─────────── */

export interface AuthResponse {
  user: { id: string; email: string; role: string };
  tokens: { accessToken: string; refreshToken: string };
}

export interface TwoFactorPendingResponse {
  requires2FA: true;
  tempToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorPendingResponse;

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
}

export function isAuthResponse(res: LoginResponse): res is AuthResponse {
  return 'tokens' in res;
}

export function is2FAPending(res: LoginResponse): res is TwoFactorPendingResponse {
  return 'requires2FA' in res && res.requires2FA === true;
}

export interface BalanceDto {
  currency: string;
  available: string;
  locked: string;
  total: string;
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

export interface TickerDto {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  quoteVolume24h: string;
  priceChangePercent24h: string;
}

export interface OrderBookDto {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

export interface OrderDto {
  id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop_limit' | 'oco' | 'trailing_stop';
  status: 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'triggered';
  price: string;
  quantity: string;
  filledQuantity: string;
  filledQuote: string;
  baseCurrency: string;
  quoteCurrency: string;
  ocoGroupId?: string | null;
  trailingDelta?: string | null;
  trailingActivationPrice?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── Token management ─────────────────────────────────── */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('novex_access_token', access);
    localStorage.setItem('novex_refresh_token', refresh);
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('novex_access_token');
    refreshToken = localStorage.getItem('novex_refresh_token');
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('novex_access_token');
    localStorage.removeItem('novex_refresh_token');
    localStorage.removeItem('novex-auth');
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem('novex_access_token');
  }
  return accessToken;
}

/* ─── Token refresh ────────────────────────────────────── */

let refreshInProgress: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Deduplicates concurrent refresh attempts (only one inflight at a time).
 */
async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      const currentRefresh = typeof window !== 'undefined'
        ? localStorage.getItem('novex_refresh_token')
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
  body?: Record<string, any>,
  opts?: { skipAuth?: boolean; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token && !opts?.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (opts?.idempotencyKey) {
    headers['X-Idempotency-Key'] = opts.idempotencyKey;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // ── WEB-1: Token refresh on 401 ──────────────────────
  if (res.status === 401 && !opts?.skipAuth) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      const retryHeaders = { ...headers, Authorization: `Bearer ${getAccessToken()}` };
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        method, headers: retryHeaders, body: body ? JSON.stringify(body) : undefined,
      });
      if (retryRes.ok) {
        return retryRes.json() as Promise<T>;
      }
    }
    // Refresh failed or retry failed — logout
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  // ── WEB-2: 403 Forbidden (KYC, account, permission) ──
  if (res.status === 403) {
    const data403 = await res.json().catch(() => null);
    const msg = data403?.message ?? 'Access denied';
    throw new PermissionError(msg);
  }

  // ── 429 Rate Limit ──────────────────────────────────
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 10;
    throw new RateLimitError(
      `Rate limit exceeded. Please wait ${seconds} seconds.`,
      seconds,
    );
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
  register(email: string, password: string, firstName?: string, lastName?: string) {
    return request<AuthResponse>('POST', '/auth/register', {
      email, password, firstName, lastName,
    }, { skipAuth: true });
  },

  login(email: string, password: string) {
    return request<LoginResponse>('POST', '/auth/login', {
      email, password,
    }, { skipAuth: true });
  },

  complete2FALogin(tempToken: string, code: string) {
    return request<AuthResponse>('POST', '/auth/2fa/login', {
      tempToken, code,
    }, { skipAuth: true });
  },

  logout() {
    return request<{ message: string }>('POST', '/auth/logout').catch(() => {
      // Best-effort — clear tokens even if server unreachable
    });
  },
};

/* ─── Two-Factor Auth ──────────────────────────────────── */

export const twoFactorApi = {
  setup() {
    return request<TwoFactorSetupResponse>('POST', '/auth/2fa/setup');
  },

  verify(token: string) {
    return request<{ enabled: boolean }>('POST', '/auth/2fa/verify', { token });
  },

  validate(token: string) {
    return request<{ valid: boolean }>('POST', '/auth/2fa/validate', { token });
  },

  disable(token: string) {
    return request<{ disabled: boolean }>('DELETE', '/auth/2fa', { token });
  },
};

/* ─── Market ───────────────────────────────────────────── */

export const marketApi = {
  getPairs() {
    return request<TradingPairDto[]>('GET', '/market/pairs', undefined, { skipAuth: true });
  },

  getTicker(pair: string) {
    return request<TickerDto>('GET', `/market/ticker/${pair}`, undefined, { skipAuth: true });
  },

  getOrderBook(pair: string, depth = 20) {
    return request<OrderBookDto>('GET', `/market/orderbook/${pair}?depth=${depth}`, undefined, { skipAuth: true });
  },

  getCandles(pair: string, timeframe = '1h') {
    return request<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[]>(
      'GET', `/market/candles/${pair}?timeframe=${timeframe}`, undefined, { skipAuth: true },
    );
  },
};

/* ─── Wallets ──────────────────────────────────────────── */

export const walletApi = {
  getBalances() {
    return request<BalanceDto[]>('GET', '/wallets/balances');
  },
};

/* ─── Trading ──────────────────────────────────────────── */

export const tradingApi = {
  placeOrder(
    dto: {
      symbol: string;
      side: 'buy' | 'sell';
      type: 'limit' | 'market' | 'stop_limit' | 'trailing_stop';
      price: string;
      quantity: string;
      stopPrice?: string;
      trailingDelta?: string;
      trailingActivationPrice?: string;
    },
    idempotencyKey?: string,
  ) {
    return request<OrderDto>('POST', '/orders', dto, { idempotencyKey });
  },

  placeOCO(
    dto: {
      symbol: string;
      side: 'buy' | 'sell';
      limitPrice: string;
      limitQuantity: string;
      stopPrice: string;
      stopQuantity: string;
    },
    idempotencyKey?: string,
  ) {
    return request<{ limitOrder: OrderDto; stopOrder: OrderDto }>(
      'POST', '/orders/oco', dto, { idempotencyKey },
    );
  },

  getOrders(params?: { symbol?: string; status?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.symbol) qs.set('symbol', params.symbol);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs}` : '';
    return request<{ orders: OrderDto[]; total: number }>('GET', `/orders${query}`);
  },

  cancelOrder(orderId: string, idempotencyKey?: string) {
    return request<OrderDto>('DELETE', `/orders/${orderId}`, undefined, { idempotencyKey });
  },
};

/* ─── Notifications ───────────────────────────────────── */

export interface NotificationDto {
  id: string;
  type: 'trade' | 'deposit' | 'withdrawal' | 'security' | 'system' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  getNotifications(limit = 10) {
    return request<NotificationDto[]>('GET', `/notifications?limit=${limit}`);
  },

  getUnreadCount() {
    return request<{ count: number }>('GET', '/notifications/unread-count');
  },

  markAsRead(notificationId: string) {
    return request<NotificationDto>('PATCH', `/notifications/${notificationId}/read`);
  },

  markAllAsRead() {
    return request<{ message: string }>('PATCH', '/notifications/read-all');
  },
};

/* ─── Referrals ────────────────────────────────────── */

export interface ReferralDto {
  id: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  status: 'pending' | 'active' | 'rewarded';
  rewardAmount: string;
  rewardCurrency: string;
  createdAt: string;
}

export interface ReferralStatsDto {
  totalReferrals: number;
  activeReferrals: number;
  rewardedReferrals: number;
  totalRewards: string;
  rewardCurrency: string;
}

export const referralApi = {
  getCode() {
    return request<{ code: string }>('GET', '/referrals/code');
  },

  getStats() {
    return request<ReferralStatsDto>('GET', '/referrals/stats');
  },

  listReferrals() {
    return request<{ referrals: ReferralDto[] }>('GET', '/referrals/list');
  },

  applyCode(code: string) {
    return request<{ success: boolean; referral: ReferralDto }>('POST', '/referrals/apply', { code });
  },
};

/* ─── Price Alerts ─────────────────────────────────── */

export interface PriceAlertDto {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: string;
  direction: 'above' | 'below';
  status: 'active' | 'triggered' | 'cancelled';
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const alertsApi = {
  create(symbol: string, targetPrice: string, direction: 'above' | 'below') {
    return request<PriceAlertDto>('POST', '/alerts', { symbol, targetPrice, direction });
  },

  list() {
    return request<PriceAlertDto[]>('GET', '/alerts');
  },

  cancel(alertId: string) {
    return request<{ message: string }>('DELETE', `/alerts/${alertId}`);
  },
};

/* ─── Staking / Earn ──────────────────────────────── */

export interface StakingProductDto {
  id: string;
  asset: string;
  name: string;
  annualRate: string;
  minAmount: string;
  maxAmount: string;
  lockDays: number;
  totalStaked: string;
  maxCapacity: string;
  status: string;
}

export interface StakingPositionDto {
  id: string;
  productId: string;
  asset: string;
  productName: string;
  amount: string;
  annualRate: string;
  startDate: string;
  endDate: string | null;
  lockDays: number;
  status: string;
  earnedReward: string;
  currentReward: string;
  createdAt: string;
}

/* ─── Fee Tiers ──────────────────────────────────── */

export interface FeeTierDto {
  id: string;
  tier: number;
  name: string;
  minVolume30d: string;
  makerFeeRate: string;
  takerFeeRate: string;
  benefits: Record<string, any>;
}

export interface UserTierDto {
  tier: number;
  name: string;
  volume30d: string;
  makerFeeRate: string;
  takerFeeRate: string;
  nextTier: { name: string; minVolume30d: string; volumeNeeded: string } | null;
}

export const feeTiersApi = {
  getAll() {
    return request<FeeTierDto[]>('GET', '/fee-tiers', undefined, { skipAuth: true });
  },

  getMy() {
    return request<UserTierDto>('GET', '/fee-tiers/my');
  },
};

/* ─── P2P Trading ────────────────────────────────── */

export interface P2pListingDto {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  asset: string;
  fiatCurrency: string;
  price: string;
  minAmount: string;
  maxAmount: string;
  paymentMethods: string[];
  status: string;
  totalAmount: string;
  filledAmount: string;
  createdAt: string;
}

export interface P2pOrderDto {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  fiatAmount: string;
  status: string;
  chatMessages: { sender: string; message: string; timestamp: string }[];
  createdAt: string;
  paidAt: string | null;
  releasedAt: string | null;
}

export const p2pApi = {
  createListing(dto: {
    type: 'buy' | 'sell';
    asset: string;
    fiatCurrency: string;
    price: string;
    minAmount: string;
    maxAmount: string;
    totalAmount: string;
    paymentMethods: string[];
  }) {
    return request<P2pListingDto>('POST', '/p2p/listings', dto);
  },

  getListings(filters?: { type?: string; asset?: string; fiatCurrency?: string }) {
    const qs = new URLSearchParams();
    if (filters?.type) qs.set('type', filters.type);
    if (filters?.asset) qs.set('asset', filters.asset);
    if (filters?.fiatCurrency) qs.set('fiatCurrency', filters.fiatCurrency);
    const query = qs.toString() ? `?${qs}` : '';
    return request<P2pListingDto[]>('GET', `/p2p/listings${query}`, undefined, { skipAuth: true });
  },

  cancelListing(id: string) {
    return request<{ message: string }>('DELETE', `/p2p/listings/${id}`);
  },

  createOrder(listingId: string, amount: string) {
    return request<P2pOrderDto>('POST', '/p2p/orders', { listingId, amount });
  },

  getMyOrders() {
    return request<P2pOrderDto[]>('GET', '/p2p/orders/my');
  },

  markAsPaid(orderId: string) {
    return request<P2pOrderDto>('PATCH', `/p2p/orders/${orderId}/paid`);
  },

  releaseCrypto(orderId: string) {
    return request<P2pOrderDto>('PATCH', `/p2p/orders/${orderId}/release`);
  },

  cancelOrder(orderId: string) {
    return request<P2pOrderDto>('PATCH', `/p2p/orders/${orderId}/cancel`);
  },
};

/* ─── Staking / Earn ──────────────────────────────── */

export const stakingApi = {
  getProducts() {
    return request<StakingProductDto[]>('GET', '/staking/products');
  },

  stake(productId: string, amount: string) {
    return request<StakingPositionDto>('POST', '/staking/stake', { productId, amount });
  },

  unstake(positionId: string) {
    return request<StakingPositionDto>('POST', `/staking/unstake/${positionId}`);
  },

  getPositions() {
    return request<StakingPositionDto[]>('GET', '/staking/positions');
  },
};

/* ─── API Keys ─────────────────────────────────── */

export interface ApiKeyPermissionsDto {
  trading: boolean;
  marketData: boolean;
  wallet: boolean;
}

export interface ApiKeyDto {
  id: string;
  label: string;
  keyPrefix: string;
  permissions: ApiKeyPermissionsDto;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string;
  label: string;
  permissions: ApiKeyPermissionsDto;
  createdAt: string;
}

export const apiKeysApi = {
  generate(label: string, permissions: ApiKeyPermissionsDto, expiresInDays?: number) {
    return request<ApiKeyCreateResponse>('POST', '/api-keys', {
      label,
      permissions,
      expiresInDays,
    });
  },

  list() {
    return request<ApiKeyDto[]>('GET', '/api-keys');
  },

  revoke(keyId: string) {
    return request<{ message: string }>('DELETE', `/api-keys/${keyId}`);
  },
};
