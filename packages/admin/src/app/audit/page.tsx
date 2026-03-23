"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import type { AuditAction, AuditLogEntry } from "@/types";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";

const actionLabels: Record<AuditAction, string> = {
  "user.freeze": "User Frozen",
  "user.unfreeze": "User Unfrozen",
  "user.kyc_approve": "KYC Approved",
  "user.kyc_reject": "KYC Rejected",
  "withdrawal.approve": "Withdrawal Approved",
  "withdrawal.reject": "Withdrawal Rejected",
  "pair.create": "Pair Created",
  "pair.enable": "Pair Enabled",
  "pair.disable": "Pair Disabled",
  "announcement.create": "Announcement Created",
  "announcement.update": "Announcement Updated",
  "announcement.delete": "Announcement Deleted",
  "settings.update": "Settings Updated",
};

const actionVariant: Record<string, "success" | "danger" | "info" | "warning" | "neutral"> = {
  "user.freeze": "danger",
  "user.unfreeze": "success",
  "user.kyc_approve": "success",
  "user.kyc_reject": "danger",
  "withdrawal.approve": "success",
  "withdrawal.reject": "danger",
  "pair.create": "info",
  "pair.enable": "success",
  "pair.disable": "warning",
  "announcement.create": "info",
  "announcement.update": "info",
  "announcement.delete": "danger",
  "settings.update": "warning",
};

const actions: AuditAction[] = [
  "user.freeze", "user.unfreeze", "user.kyc_approve", "user.kyc_reject",
  "withdrawal.approve", "withdrawal.reject", "pair.create", "pair.enable",
  "pair.disable", "announcement.create", "announcement.update", "settings.update",
];

const actors = ["admin@novex.io", "ops@novex.io", "compliance@novex.io"];

// TODO: Replace mock data with real data from GET /admin/audit-logs when backend endpoint is built.
//       Wire this page to adminApi.getAuditLogs() once the endpoint exists.
const mockAuditLogs: AuditLogEntry[] = Array.from({ length: 80 }, (_, i) => {
  const action = actions[i % actions.length]!;
  const resourceType = action.split(".")[0]!;
  return {
    id: `audit_${String(i + 1).padStart(5, "0")}`,
    actor: `admin_${(i % 3) + 1}`,
    actorEmail: actors[i % 3]!,
    action,
    resourceType,
    resourceId: `${resourceType}_${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`,
    metadata: {},
    ipAddress: `192.168.1.${(i % 254) + 1}`,
    timestamp: new Date(2026, 2, 22, 23 - Math.floor(i / 3), 59 - (i * 7) % 60).toISOString(),
  };
});

export default function AuditPage() {
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "">("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filtered = useMemo(() => {
    return mockAuditLogs.filter((log) => {
      if (actorFilter && !log.actorEmail.toLowerCase().includes(actorFilter.toLowerCase())) return false;
      if (actionFilter && log.action !== actionFilter) return false;
      if (resourceFilter && log.resourceType !== resourceFilter) return false;
      if (startDate && new Date(log.timestamp) < new Date(startDate)) return false;
      if (endDate && new Date(log.timestamp) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [actorFilter, actionFilter, resourceFilter, startDate, endDate]);

  const columns: ColumnDef<AuditLogEntry, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        cell: ({ getValue }) => (
          <span className="text-xs text-surface-400">{format(new Date(getValue<string>()), "MMM d, HH:mm:ss")}</span>
        ),
      },
      {
        accessorKey: "actorEmail",
        header: "Actor",
        cell: ({ getValue }) => <span className="text-sm text-surface-200">{getValue<string>()}</span>,
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ getValue }) => {
          const a = getValue<AuditAction>();
          return <Badge variant={actionVariant[a] ?? "neutral"}>{actionLabels[a]}</Badge>;
        },
      },
      {
        accessorKey: "resourceType",
        header: "Resource",
        cell: ({ row }) => (
          <div>
            <span className="text-xs capitalize text-surface-300">{row.original.resourceType}</span>
            <span className="ml-1 font-mono text-xs text-surface-500">{row.original.resourceId}</span>
          </div>
        ),
      },
      {
        accessorKey: "ipAddress",
        header: "IP Address",
        cell: ({ getValue }) => <span className="font-mono text-xs text-surface-400">{getValue<string>()}</span>,
      },
    ],
    []
  );

  const resetFilters = () => {
    setActorFilter("");
    setActionFilter("");
    setResourceFilter("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Audit Logs</h1>
        <p className="text-sm text-surface-400">Track all administrative actions and changes</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2 text-sm text-surface-400">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Search actor..."
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Action</label>
            <select
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AuditAction | "")}
            >
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{actionLabels[a]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Resource Type</label>
            <select
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-novex-500 focus:outline-none"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              <option value="">All Resources</option>
              <option value="user">User</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="pair">Trading Pair</option>
              <option value="announcement">Announcement</option>
              <option value="settings">Settings</option>
            </select>
          </div>
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-surface-500">{filtered.length} entries found</span>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset Filters</Button>
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} pageSize={15} />
    </div>
  );
}
