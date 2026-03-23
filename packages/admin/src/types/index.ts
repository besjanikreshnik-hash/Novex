// ─── User & KYC ──────────────────────────────────────────────────────
export type KycTier = "none" | "basic" | "advanced" | "institutional";
export type KycStatus = "pending" | "approved" | "rejected" | "expired";
export type UserStatus = "active" | "frozen" | "suspended" | "pending_verification";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  kycTier: KycTier;
  kycStatus: KycStatus;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  totalTradeVolume: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

export interface UserBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
  usdValue: number;
}

export interface UserLoginHistory {
  id: string;
  ip: string;
  userAgent: string;
  location: string;
  timestamp: string;
  success: boolean;
}

export interface KycSubmission {
  id: string;
  userId: string;
  userEmail: string;
  tier: KycTier;
  status: KycStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  documents: KycDocument[];
  notes: string;
}

export interface KycDocument {
  id: string;
  type: "passport" | "drivers_license" | "national_id" | "proof_of_address" | "selfie";
  filename: string;
  uploadedAt: string;
  status: "pending" | "verified" | "rejected";
}

// ─── Orders & Trading ────────────────────────────────────────────────
export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market" | "stop_limit";
export type OrderStatus = "open" | "filled" | "partially_filled" | "cancelled";

export interface Order {
  id: string;
  userId: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string;
  quantity: string;
  filled: string;
  total: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: "active" | "disabled" | "delisted";
  minOrderSize: string;
  maxOrderSize: string;
  tickSize: string;
  stepSize: string;
  makerFee: string;
  takerFee: string;
  lastPrice: string;
  volume24h: string;
  createdAt: string;
}

// ─── Withdrawals ─────────────────────────────────────────────────────
export type WithdrawalStatus = "pending" | "approved" | "rejected" | "processing" | "completed" | "failed";

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  asset: string;
  amount: string;
  fee: string;
  network: string;
  address: string;
  txHash: string | null;
  status: WithdrawalStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string;
}

// ─── Deposits ────────────────────────────────────────────────────────
export type DepositStatus = "pending" | "confirmed" | "credited" | "failed";

export interface Deposit {
  id: string;
  userId: string;
  asset: string;
  amount: string;
  network: string;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
  status: DepositStatus;
  createdAt: string;
  creditedAt: string | null;
}

// ─── Audit Log ───────────────────────────────────────────────────────
export type AuditAction =
  | "user.freeze"
  | "user.unfreeze"
  | "user.kyc_approve"
  | "user.kyc_reject"
  | "withdrawal.approve"
  | "withdrawal.reject"
  | "pair.create"
  | "pair.enable"
  | "pair.disable"
  | "announcement.create"
  | "announcement.update"
  | "announcement.delete"
  | "settings.update";

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

// ─── Announcements ───────────────────────────────────────────────────
export type AnnouncementType = "info" | "warning" | "maintenance" | "update";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  active: boolean;
  pinned: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishAt: string | null;
  expiresAt: string | null;
}

// ─── Dashboard Metrics ───────────────────────────────────────────────
export interface DashboardMetrics {
  totalUsers: number;
  activeUsers24h: number;
  volume24h: number;
  volume24hChange: number;
  activeOrders: number;
  activeOrdersChange: number;
  pendingWithdrawals: number;
  pendingKyc: number;
  revenue24h: number;
  revenue24hChange: number;
  volumeHistory: { date: string; volume: number }[];
  userGrowth: { date: string; users: number }[];
  revenueHistory: { date: string; revenue: number }[];
}

// ─── API Responses ───────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// ─── Filters ─────────────────────────────────────────────────────────
export interface UserFilters {
  search?: string;
  status?: UserStatus;
  kycTier?: KycTier;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AuditLogFilters {
  actor?: string;
  action?: AuditAction;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface WithdrawalFilters {
  status?: WithdrawalStatus;
  asset?: string;
  page?: number;
  pageSize?: number;
}
