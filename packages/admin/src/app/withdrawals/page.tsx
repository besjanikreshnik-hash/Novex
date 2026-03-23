"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { formatCurrency, truncateAddress } from "@/lib/utils";
import type { Withdrawal, WithdrawalStatus } from "@/types";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle, Clock, Filter, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const mockWithdrawals: Withdrawal[] = [
  { id: "wd_001", userId: "usr_000003", userEmail: "carol@defi.net", asset: "BTC", amount: "2.50000000", fee: "0.00050000", network: "Bitcoin", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", txHash: null, status: "pending", createdAt: "2026-03-22T08:00:00Z", reviewedAt: null, reviewedBy: null, notes: "" },
  { id: "wd_002", userId: "usr_000007", userEmail: "grace@blockchain.net", asset: "ETH", amount: "50.00000000", fee: "0.00500000", network: "Ethereum", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD55", txHash: null, status: "pending", createdAt: "2026-03-22T07:30:00Z", reviewedAt: null, reviewedBy: null, notes: "" },
  { id: "wd_003", userId: "usr_000015", userEmail: "whale@crypto.com", asset: "USDT", amount: "250000.00", fee: "25.00", network: "Ethereum (ERC-20)", address: "0x1234567890abcdef1234567890abcdef12345678", txHash: null, status: "pending", createdAt: "2026-03-22T06:15:00Z", reviewedAt: null, reviewedBy: null, notes: "Large withdrawal - requires manual review" },
  { id: "wd_004", userId: "usr_000022", userEmail: "dave@wallet.xyz", asset: "SOL", amount: "1000.00", fee: "0.01", network: "Solana", address: "DRpbCBMxVnDK7maPMoKSbcqGWE8RqfjnQ7nHFGZFQDXB", txHash: "5xYz...abc123", status: "approved", createdAt: "2026-03-22T05:00:00Z", reviewedAt: "2026-03-22T05:15:00Z", reviewedBy: "admin@novex.io", notes: "Approved - regular user" },
  { id: "wd_005", userId: "usr_000008", userEmail: "heidi@token.xyz", asset: "BTC", amount: "0.10000000", fee: "0.00010000", network: "Bitcoin", address: "bc1q9h5yjqka3gf8r7549ef9trkxgmqz8agk9gxnsr", txHash: null, status: "rejected", createdAt: "2026-03-21T23:00:00Z", reviewedAt: "2026-03-22T01:00:00Z", reviewedBy: "admin@novex.io", notes: "Suspicious activity detected" },
  ...Array.from({ length: 32 }, (_, i) => ({
    id: `wd_${String(i + 6).padStart(3, "0")}`,
    userId: `usr_${String(100 + i).padStart(6, "0")}`,
    userEmail: `user${100 + i}@example.com`,
    asset: (["BTC", "ETH", "USDT", "SOL", "AVAX"] as const)[i % 5]!,
    amount: (Math.random() * 10).toFixed(8),
    fee: (Math.random() * 0.01).toFixed(8),
    network: (["Bitcoin", "Ethereum", "Ethereum (ERC-20)", "Solana", "Avalanche"] as const)[i % 5]!,
    address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    txHash: null,
    status: "pending" as const,
    createdAt: new Date(2026, 2, 22 - (i % 3), 10 - (i % 10)).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    notes: "",
  })),
];

const statusVariant: Record<WithdrawalStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  processing: "info",
  completed: "success",
  failed: "danger",
};

export default function WithdrawalsPage() {
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | "">("");

  const filtered = useMemo(() => {
    if (!statusFilter) return mockWithdrawals;
    return mockWithdrawals.filter((w) => w.status === statusFilter);
  }, [statusFilter]);

  const pendingCount = mockWithdrawals.filter((w) => w.status === "pending").length;
  const pendingValue = mockWithdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => {
      if (w.asset === "BTC") return sum + parseFloat(w.amount) * 67200;
      if (w.asset === "ETH") return sum + parseFloat(w.amount) * 3620;
      if (w.asset === "USDT") return sum + parseFloat(w.amount);
      if (w.asset === "SOL") return sum + parseFloat(w.amount) * 150;
      return sum + parseFloat(w.amount) * 35;
    }, 0);

  const columns: ColumnDef<Withdrawal, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => <span className="font-mono text-xs text-surface-400">{getValue<string>()}</span>,
      },
      {
        accessorKey: "userEmail",
        header: "User",
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-surface-200">{row.original.userEmail}</p>
            <p className="font-mono text-xs text-surface-500">{row.original.userId}</p>
          </div>
        ),
      },
      {
        accessorKey: "asset",
        header: "Asset",
        cell: ({ getValue }) => <span className="font-semibold text-surface-100">{getValue<string>()}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm text-surface-100">{row.original.amount}</p>
            <p className="font-mono text-xs text-surface-500">Fee: {row.original.fee}</p>
          </div>
        ),
      },
      {
        accessorKey: "network",
        header: "Network",
        cell: ({ getValue }) => <span className="text-xs text-surface-300">{getValue<string>()}</span>,
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-surface-400">{truncateAddress(getValue<string>(), 8)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<WithdrawalStatus>();
          return <Badge variant={statusVariant[s]} dot>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Requested",
        cell: ({ getValue }) => (
          <span className="text-xs text-surface-400">{format(new Date(getValue<string>()), "MMM d, HH:mm")}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.status !== "pending") return <span className="text-xs text-surface-600">--</span>;
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}>
                Approve
              </Button>
              <Button variant="ghost" size="sm" icon={<XCircle className="h-4 w-4 text-red-400" />}>
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Withdrawal Approvals</h1>
        <p className="text-sm text-surface-400">Review and process pending withdrawal requests</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-surface-300">Pending Withdrawals</span>
          </div>
          <Badge variant="warning">{pendingCount}</Badge>
        </div>
        <div className="card flex items-center justify-between">
          <span className="text-sm text-surface-300">Pending Value (est.)</span>
          <span className="text-sm font-semibold text-surface-100">{formatCurrency(pendingValue)}</span>
        </div>
        <div className="card flex items-center justify-between">
          <span className="text-sm text-surface-300">Processed Today</span>
          <Badge variant="success">12</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-surface-500" />
        <select
          className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WithdrawalStatus | "")}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-xs text-surface-500">{filtered.length} results</span>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} pageSize={10} />
    </div>
  );
}
