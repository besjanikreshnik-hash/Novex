import Decimal from 'decimal.js';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  kycStatus: KycStatus;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

// ── Market ────────────────────────────────────────────────────────────────────

export interface TradingPair {
  symbol: string;        // "BTC/USDT"
  baseAsset: string;     // "BTC"
  quoteAsset: string;    // "USDT"
  lastPrice: string;
  change24h: string;     // Percentage, e.g. "2.54"
  high24h: string;
  low24h: string;
  volume24h: string;
  sparkline: number[];   // Mini price series for chart
}

export interface OrderBookLevel {
  price: string;
  amount: string;
  total: string;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdated: number;
}

export interface Ticker {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
}

// ── Trading ───────────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string | null;
  amount: string;
  filled: string;
  remaining: string;
  createdAt: string;
}

export interface PlaceOrderPayload {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  amount: string;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletAsset {
  asset: string;         // "BTC"
  name: string;          // "Bitcoin"
  available: string;
  locked: string;        // In open orders
  usdValue: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'trade';
  asset: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface PortfolioSummary {
  totalValueUsd: string;
  change24h: string;
  change24hPercent: string;
  allocations: PortfolioAllocation[];
}

export interface PortfolioAllocation {
  asset: string;
  name: string;
  percentage: number;
  valueUsd: string;
  color: string;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export type WsEvent =
  | { type: 'ticker'; data: Ticker }
  | { type: 'orderbook'; data: OrderBook & { symbol: string } }
  | { type: 'trade'; data: { symbol: string; price: string; amount: string; side: OrderSide; timestamp: number } };

// ── Utility ───────────────────────────────────────────────────────────────────

export type DecimalLike = string | number | Decimal;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
