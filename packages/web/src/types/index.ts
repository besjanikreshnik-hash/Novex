export interface User {
  id: string;
  email: string;
  username: string;
  kycStatus: "none" | "pending" | "verified" | "rejected";
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  basePrecision: number;
  quotePrecision: number;
  minOrderSize: string;
  maxOrderSize: string;
  tickSize: string;
  status: "active" | "halted" | "delisted";
}

export interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  quoteVolume24h: string;
  bidPrice: string;
  askPrice: string;
  timestamp: number;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
  total: string;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
  timestamp: number;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop_limit";
export type OrderStatus =
  | "open"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "expired";

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  averagePrice: string;
  stopPrice?: string;
  timeInForce: "GTC" | "IOC" | "FOK";
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: string;
  quantity: string;
  quoteQuantity: string;
  side: OrderSide;
  timestamp: number;
  isBuyerMaker: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WalletBalance {
  asset: string;
  name: string;
  available: string;
  locked: string;
  total: string;
  usdValue: string;
  iconUrl?: string;
}

export interface Wallet {
  userId: string;
  balances: WalletBalance[];
  totalUsdValue: string;
  updatedAt: string;
}

export type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}
