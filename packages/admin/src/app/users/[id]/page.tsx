"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency } from "@/lib/utils";
import type { Deposit, Order, UserBalance, UserLoginHistory } from "@/types";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  Shield,
  Snowflake,
  SunMedium,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";

// ─── Mock Data ────────────────────────────────────────────────────
const mockUser = {
  id: "usr_000001",
  email: "alice@crypto.com",
  displayName: "Alice Johnson",
  kycTier: "advanced" as const,
  kycStatus: "approved" as const,
  status: "active" as const,
  createdAt: "2024-01-15T10:30:00Z",
  lastLoginAt: "2026-03-22T08:15:00Z",
  twoFactorEnabled: true,
  emailVerified: true,
  totalTradeVolume: 2_450_000,
  totalDeposits: 1_200_000,
  totalWithdrawals: 850_000,
};

const mockBalances: UserBalance[] = [
  { asset: "BTC", available: "2.45000000", locked: "0.50000000", total: "2.95000000", usdValue: 198_250 },
  { asset: "ETH", available: "35.12000000", locked: "5.00000000", total: "40.12000000", usdValue: 145_634 },
  { asset: "USDT", available: "125000.00", locked: "15000.00", total: "140000.00", usdValue: 140_000 },
  { asset: "SOL", available: "500.00", locked: "0.00", total: "500.00", usdValue: 75_000 },
  { asset: "AVAX", available: "1200.00", locked: "200.00", total: "1400.00", usdValue: 56_000 },
];

const mockOrders: Order[] = [
  { id: "ord_001", userId: "usr_000001", pair: "BTC/USDT", side: "buy", type: "limit", status: "filled", price: "67250.00", quantity: "0.5", filled: "0.5", total: "33625.00", createdAt: "2026-03-22T07:30:00Z", updatedAt: "2026-03-22T07:31:00Z" },
  { id: "ord_002", userId: "usr_000001", pair: "ETH/USDT", side: "sell", type: "market", status: "filled", price: "3624.50", quantity: "10.0", filled: "10.0", total: "36245.00", createdAt: "2026-03-21T15:20:00Z", updatedAt: "2026-03-21T15:20:02Z" },
  { id: "ord_003", userId: "usr_000001", pair: "SOL/USDT", side: "buy", type: "limit", status: "open", price: "145.00", quantity: "100.0", filled: "0.0", total: "14500.00", createdAt: "2026-03-22T09:00:00Z", updatedAt: "2026-03-22T09:00:00Z" },
  { id: "ord_004", userId: "usr_000001", pair: "BTC/USDT", side: "sell", type: "stop_limit", status: "cancelled", price: "65000.00", quantity: "0.25", filled: "0.0", total: "16250.00", createdAt: "2026-03-20T12:00:00Z", updatedAt: "2026-03-20T18:00:00Z" },
];

const mockDeposits: Deposit[] = [
  { id: "dep_001", userId: "usr_000001", asset: "BTC", amount: "1.00000000", network: "Bitcoin", txHash: "abc123...def789", confirmations: 6, requiredConfirmations: 3, status: "credited", createdAt: "2026-03-20T10:00:00Z", creditedAt: "2026-03-20T10:45:00Z" },
  { id: "dep_002", userId: "usr_000001", asset: "USDT", amount: "50000.00", network: "Ethereum (ERC-20)", txHash: "0xabc...789", confirmations: 35, requiredConfirmations: 12, status: "credited", createdAt: "2026-03-18T14:00:00Z", creditedAt: "2026-03-18T14:08:00Z" },
];

const mockLoginHistory: UserLoginHistory[] = [
  { id: "1", ip: "192.168.1.100", userAgent: "Chrome 122 / macOS", location: "San Francisco, US", timestamp: "2026-03-22T08:15:00Z", success: true },
  { id: "2", ip: "192.168.1.100", userAgent: "Chrome 122 / macOS", location: "San Francisco, US", timestamp: "2026-03-21T09:30:00Z", success: true },
  { id: "3", ip: "10.0.0.55", userAgent: "Safari / iOS 18", location: "San Francisco, US", timestamp: "2026-03-20T18:00:00Z", success: true },
  { id: "4", ip: "45.32.100.200", userAgent: "Firefox / Linux", location: "Unknown", timestamp: "2026-03-19T03:15:00Z", success: false },
  { id: "5", ip: "192.168.1.100", userAgent: "Chrome 122 / macOS", location: "San Francisco, US", timestamp: "2026-03-18T10:00:00Z", success: true },
];

const orderStatusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  filled: "success",
  open: "info",
  partially_filled: "warning",
  cancelled: "neutral",
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = { ...mockUser, id };

  const balanceColumns: ColumnDef<UserBalance, unknown>[] = useMemo(
    () => [
      { accessorKey: "asset", header: "Asset", cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span> },
      { accessorKey: "available", header: "Available", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
      { accessorKey: "locked", header: "Locked", cell: ({ getValue }) => <span className="font-mono text-xs text-amber-400">{getValue<string>()}</span> },
      { accessorKey: "total", header: "Total", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
      { accessorKey: "usdValue", header: "USD Value", cell: ({ getValue }) => formatCurrency(getValue<number>()) },
    ],
    []
  );

  const orderColumns: ColumnDef<Order, unknown>[] = useMemo(
    () => [
      { accessorKey: "pair", header: "Pair" },
      {
        accessorKey: "side",
        header: "Side",
        cell: ({ getValue }) => {
          const side = getValue<string>();
          return (
            <span className={side === "buy" ? "text-emerald-400" : "text-red-400"}>
              {side.toUpperCase()}
            </span>
          );
        },
      },
      { accessorKey: "type", header: "Type", cell: ({ getValue }) => <span className="capitalize">{getValue<string>().replace("_", " ")}</span> },
      { accessorKey: "price", header: "Price", cell: ({ getValue }) => <span className="font-mono text-xs">${getValue<string>()}</span> },
      { accessorKey: "quantity", header: "Qty", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>();
          return <Badge variant={orderStatusVariant[s] ?? "neutral"}>{s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</Badge>;
        },
      },
      { accessorKey: "createdAt", header: "Date", cell: ({ getValue }) => <span className="text-xs text-surface-400">{format(new Date(getValue<string>()), "MMM d, HH:mm")}</span> },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/users" className="mb-3 inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200">
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-50">{user.displayName}</h1>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-mono text-sm text-surface-400">{user.id}</span>
              <button className="text-surface-500 hover:text-surface-300"><Copy className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="flex gap-2">
            {user.status === "active" ? (
              <Button variant="danger" icon={<Snowflake className="h-4 w-4" />}>Freeze Account</Button>
            ) : (
              <Button variant="secondary" icon={<SunMedium className="h-4 w-4" />}>Unfreeze Account</Button>
            )}
            <Button variant="outline" icon={<Ban className="h-4 w-4" />}>Suspend</Button>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-surface-100">Profile</h2>
          <div className="space-y-3">
            {[
              { label: "Email", value: user.email, icon: <Mail className="h-4 w-4" /> },
              { label: "Status", value: user.status, badge: true },
              { label: "Email Verified", value: user.emailVerified ? "Yes" : "No", icon: user.emailVerified ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" /> },
              { label: "2FA", value: user.twoFactorEnabled ? "Enabled" : "Disabled", icon: <Shield className="h-4 w-4" /> },
              { label: "Created", value: format(new Date(user.createdAt), "MMM d, yyyy"), icon: <Clock className="h-4 w-4" /> },
              { label: "Last Login", value: user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy HH:mm") : "Never", icon: <Clock className="h-4 w-4" /> },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-surface-800/50 pb-2 last:border-0">
                <span className="text-xs text-surface-500">{row.label}</span>
                {row.badge ? (
                  <Badge variant={user.status === "active" ? "success" : "danger"} dot>
                    {row.value.toString().replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Badge>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-surface-200">
                    {row.icon}
                    {row.value.toString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* KYC */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-surface-100">KYC Information</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-surface-800/50 pb-2">
              <span className="text-xs text-surface-500">Tier</span>
              <Badge variant="success">{user.kycTier.charAt(0).toUpperCase() + user.kycTier.slice(1)}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-surface-800/50 pb-2">
              <span className="text-xs text-surface-500">Status</span>
              <Badge variant="success" dot>Approved</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-surface-800/50 pb-2">
              <span className="text-xs text-surface-500">Documents</span>
              <span className="text-xs text-surface-200">Passport, Selfie, Proof of Address</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-surface-500">Verified On</span>
              <span className="text-xs text-surface-200">Jan 20, 2024</span>
            </div>
          </div>
        </div>

        {/* Volume Stats */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-surface-100">Volume Statistics</h2>
          <div className="space-y-3">
            {[
              { label: "Total Trade Volume", value: formatCurrency(user.totalTradeVolume) },
              { label: "Total Deposits", value: formatCurrency(user.totalDeposits) },
              { label: "Total Withdrawals", value: formatCurrency(user.totalWithdrawals) },
              { label: "Net Balance (USD)", value: formatCurrency(mockBalances.reduce((s, b) => s + b.usdValue, 0)) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-surface-800/50 pb-2 last:border-0">
                <span className="text-xs text-surface-500">{row.label}</span>
                <span className="text-sm font-semibold text-surface-100">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Balances */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-surface-100">Balances</h2>
        <DataTable columns={balanceColumns} data={mockBalances} pageSize={10} />
      </div>

      {/* Recent Orders */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-surface-100">Recent Orders</h2>
        <DataTable columns={orderColumns} data={mockOrders} pageSize={10} />
      </div>

      {/* Login History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-surface-100">Login History</h2>
        <div className="overflow-x-auto rounded-lg border border-surface-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 bg-surface-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">Result</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {mockLoginHistory.map((entry) => (
                <tr key={entry.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-surface-300">{entry.ip}</td>
                  <td className="px-4 py-3 text-xs text-surface-300">{entry.userAgent}</td>
                  <td className="px-4 py-3 text-xs text-surface-300">{entry.location}</td>
                  <td className="px-4 py-3">
                    <Badge variant={entry.success ? "success" : "danger"} dot>
                      {entry.success ? "Success" : "Failed"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-400">
                    {format(new Date(entry.timestamp), "MMM d, HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
