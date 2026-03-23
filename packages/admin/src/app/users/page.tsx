"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import type { AdminUser, KycTier, UserStatus } from "@/types";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye, Search, Snowflake, SunMedium, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

// ─── Mock Data ────────────────────────────────────────────────────
// TODO: Replace with real data from GET /admin/users when backend endpoint is built.
//       The backend does not have an admin user listing endpoint yet.
//       Wire this page to adminApi.getUsers() once the endpoint exists.
const mockUsers: AdminUser[] = Array.from({ length: 50 }, (_, i) => ({
  id: `usr_${String(i + 1).padStart(6, "0")}`,
  email: [
    "alice@crypto.com", "bob@trading.io", "carol@defi.net", "dave@wallet.xyz",
    "eve@exchange.com", "frank@hodl.io", "grace@blockchain.net", "heidi@token.xyz",
    "ivan@mining.com", "judy@nft.io",
  ][i % 10]!,
  displayName: [
    "Alice Johnson", "Bob Smith", "Carol Williams", "Dave Brown", "Eve Davis",
    "Frank Miller", "Grace Wilson", "Heidi Moore", "Ivan Taylor", "Judy Anderson",
  ][i % 10]!,
  kycTier: (["none", "basic", "advanced", "institutional"] as KycTier[])[i % 4]!,
  kycStatus: (["pending", "approved", "approved", "approved"] as const)[i % 4]!,
  status: (["active", "active", "active", "frozen", "pending_verification"] as UserStatus[])[i % 5]!,
  createdAt: new Date(2024, 0, 1 + i).toISOString(),
  lastLoginAt: i % 3 === 0 ? null : new Date(2026, 2, 20 - (i % 7)).toISOString(),
  twoFactorEnabled: i % 2 === 0,
  emailVerified: i % 5 !== 4,
  totalTradeVolume: Math.round(Math.random() * 5_000_000),
  totalDeposits: Math.round(Math.random() * 2_000_000),
  totalWithdrawals: Math.round(Math.random() * 1_500_000),
}));

const kycTierVariant: Record<KycTier, "neutral" | "info" | "success" | "warning"> = {
  none: "neutral",
  basic: "info",
  advanced: "success",
  institutional: "warning",
};

const statusVariant: Record<UserStatus, "success" | "danger" | "warning" | "neutral"> = {
  active: "success",
  frozen: "danger",
  suspended: "danger",
  pending_verification: "warning",
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [kycFilter, setKycFilter] = useState<KycTier | "">("");

  const filtered = useMemo(() => {
    return mockUsers.filter((u) => {
      if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.id.includes(search)) {
        return false;
      }
      if (statusFilter && u.status !== statusFilter) return false;
      if (kycFilter && u.kycTier !== kycFilter) return false;
      return true;
    });
  }, [search, statusFilter, kycFilter]);

  const columns: ColumnDef<AdminUser, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-surface-400">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-surface-100">{row.original.email}</p>
            <p className="text-xs text-surface-500">{row.original.displayName}</p>
          </div>
        ),
      },
      {
        accessorKey: "kycTier",
        header: "KYC Tier",
        cell: ({ getValue }) => {
          const tier = getValue<KycTier>();
          return (
            <Badge variant={kycTierVariant[tier]}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<UserStatus>();
          return (
            <Badge variant={statusVariant[status]} dot>
              {status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="text-xs text-surface-400">
            {format(new Date(getValue<string>()), "MMM d, yyyy")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link href={`/users/${row.original.id}`}>
              <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}>
                View
              </Button>
            </Link>
            {row.original.status === "active" ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Snowflake className="h-4 w-4 text-blue-400" />}
              >
                Freeze
              </Button>
            ) : row.original.status === "frozen" ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<SunMedium className="h-4 w-4 text-amber-400" />}
              >
                Unfreeze
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Users</h1>
          <p className="text-sm text-surface-400">
            Manage user accounts, KYC status, and access
          </p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />}>Add User</Button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-72">
            <Input
              placeholder="Search by email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Status</label>
            <select
              className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none focus:ring-1 focus:ring-novex-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="suspended">Suspended</option>
              <option value="pending_verification">Pending Verification</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">KYC Tier</label>
            <select
              className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none focus:ring-1 focus:ring-novex-500"
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value as KycTier | "")}
            >
              <option value="">All Tiers</option>
              <option value="none">None</option>
              <option value="basic">Basic</option>
              <option value="advanced">Advanced</option>
              <option value="institutional">Institutional</option>
            </select>
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setKycFilter("");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} pageSize={10} />
    </div>
  );
}
