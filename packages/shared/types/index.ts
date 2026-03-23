// ============================================================
// NovEx — Shared Type Definitions
// Used across backend, web, mobile, admin, and extension
// ============================================================

// ── Auth ─────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
  deviceFingerprint?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  referralCode?: string;
  deviceFingerprint?: string;
}

// ── User ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  status: UserStatus;
  kycTier: KYCTier;
  referralCode: string;
  createdAt: string;
}

export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';
export type KYCTier = 0 | 1 | 2;

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  country: string | null;
  timezone: string;
  locale: string;
}

// ── Wallet ───────────────────────────────────────────────────

export interface WalletBalance {
  assetId: string;
  asset: string;       // symbol e.g. BTC
  assetName: string;   // full name e.g. Bitcoin
  available: string;   // decimal string
  locked: string;      // decimal string
  total: string;       // decimal string
  usdValue: string;    // decimal string
}

export interface DepositAddress {
  id: string;
  asset: string;
  network: string;
  address: string;
  memo: string | null;
}

export interface Deposit {
  id: string;
  asset: string;
  network: string;
  txHash: string;
  amount: string;
  confirmations: number;
  requiredConfirmations: number;
  status: DepositStatus;
  creditedAt: string | null;
  createdAt: string;
}

export type DepositStatus = 'pending' | 'confirming' | 'credited' | 'failed';

export interface WithdrawalRequest {
  asset: string;
  network: string;
  address: string;
  memo?: string;
  amount: string;
  twoFactorCode: string;
}

export interface Withdrawal {
  id: string;
  asset: string;
  network: string;
  address: string;
  memo: string | null;
  amount: string;
  fee: string;
  txHash: string | null;
  status: WithdrawalStatus;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';

// ── Trading ──────────────────────────────────────────────────

export interface TradingPair {
  id: string;
  symbol: string;        // e.g. BTC_USDT
  baseAsset: string;     // e.g. BTC
  quoteAsset: string;    // e.g. USDT
  priceDecimals: number;
  qtyDecimals: number;
  minQty: string;
  maxQty: string;
  minNotional: string;
  makerFee: string;
  takerFee: string;
  status: 'active' | 'suspended' | 'delisted';
}

export interface Order {
  id: string;
  pairSymbol: string;
  side: OrderSide;
  type: OrderType;
  price: string | null;
  quantity: string;
  filledQty: string;
  remainingQty: string;
  avgFillPrice: string | null;
  status: OrderStatus;
  timeInForce: TimeInForce;
  createdAt: string;
  updatedAt: string;
}

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface PlaceOrderRequest {
  pairSymbol: string;
  side: OrderSide;
  type: OrderType;
  price?: string;       // required for limit orders
  quantity: string;
  timeInForce?: TimeInForce;
}

export interface Trade {
  id: string;
  pairSymbol: string;
  price: string;
  quantity: string;
  fee: string;
  isMaker: boolean;
  side: OrderSide;
  createdAt: string;
}

// ── Market Data ──────────────────────────────────────────────

export interface Ticker {
  pair: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  quoteVolume24h: string;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
  total: string;       // cumulative
}

export interface OrderBookSnapshot {
  pair: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
}

export interface Candle {
  openTime: number;    // unix timestamp ms
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface RecentTrade {
  id: string;
  price: string;
  quantity: string;
  time: string;
  isBuyerMaker: boolean;
}

// ── Notifications ────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface PriceAlert {
  id: string;
  pairSymbol: string;
  condition: 'above' | 'below';
  targetPrice: string;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

// ── Referral ─────────────────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommission: string;
  pendingCommission: string;
  referralCode: string;
  referralLink: string;
}

// ── API Response Wrappers ────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

// ── WebSocket Messages ───────────────────────────────────────

export interface WsTickerUpdate {
  type: 'ticker';
  data: Ticker;
}

export interface WsOrderBookUpdate {
  type: 'orderbook';
  data: {
    pair: string;
    bids: [string, string][];  // [price, qty]
    asks: [string, string][];
    lastUpdateId: number;
  };
}

export interface WsTradeUpdate {
  type: 'trade';
  data: RecentTrade;
}

export interface WsOrderUpdate {
  type: 'order';
  data: Order;
}

export interface WsBalanceUpdate {
  type: 'balance';
  data: WalletBalance;
}

export type WsMessage =
  | WsTickerUpdate
  | WsOrderBookUpdate
  | WsTradeUpdate
  | WsOrderUpdate
  | WsBalanceUpdate;
