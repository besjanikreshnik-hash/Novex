"use client";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { Badge } from "@/components/ui/Badge";
import { marketApi } from "@/lib/api";
import { formatCompact, formatCurrency } from "@/lib/utils";
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// ─── Mock Data (TODO: replace with GET /admin/metrics when backend endpoint is built) ───
const volumeHistory = [
  { date: "Mar 16", volume: 48_200_000 },
  { date: "Mar 17", volume: 52_100_000 },
  { date: "Mar 18", volume: 61_300_000 },
  { date: "Mar 19", volume: 45_800_000 },
  { date: "Mar 20", volume: 58_600_000 },
  { date: "Mar 21", volume: 72_400_000 },
  { date: "Mar 22", volume: 68_900_000 },
];

const userGrowthMini = [
  { value: 1200 }, { value: 1350 }, { value: 1280 }, { value: 1500 },
  { value: 1420 }, { value: 1650 }, { value: 1800 },
];

const volumeMini = [
  { value: 48 }, { value: 52 }, { value: 61 }, { value: 45 },
  { value: 58 }, { value: 72 }, { value: 68 },
];

const ordersMini = [
  { value: 3200 }, { value: 3500 }, { value: 3100 }, { value: 3800 },
  { value: 4200 }, { value: 3900 }, { value: 4100 },
];

const revenueMini = [
  { value: 120 }, { value: 135 }, { value: 142 }, { value: 128 },
  { value: 155 }, { value: 168 }, { value: 162 },
];

// TODO: Replace with real activity from GET /admin/activity or GET /notifications
const recentActivity = [
  { id: "1", action: "KYC Approved", user: "john@example.com", time: "2 min ago", type: "success" as const },
  { id: "2", action: "Withdrawal Pending", user: "alice@example.com", time: "5 min ago", type: "warning" as const },
  { id: "3", action: "User Frozen", user: "suspicious@test.com", time: "12 min ago", type: "danger" as const },
  { id: "4", action: "New User Registered", user: "newuser@mail.com", time: "18 min ago", type: "info" as const },
  { id: "5", action: "Large Withdrawal", user: "whale@crypto.com", time: "25 min ago", type: "warning" as const },
  { id: "6", action: "Trading Pair Added", user: "admin@novex.io", time: "1 hr ago", type: "info" as const },
];

const revenueHistory = [
  { date: "Mar 16", revenue: 124_500 },
  { date: "Mar 17", revenue: 138_200 },
  { date: "Mar 18", revenue: 152_800 },
  { date: "Mar 19", revenue: 118_600 },
  { date: "Mar 20", revenue: 145_300 },
  { date: "Mar 21", revenue: 172_100 },
  { date: "Mar 22", revenue: 165_400 },
];

export default function DashboardPage() {
  // Real data from backend
  const [pairCount, setPairCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch real trading pair count from GET /market/pairs
    marketApi.getPairs()
      .then((pairs) => setPairCount(pairs.length))
      .catch(() => setPairCount(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Dashboard</h1>
        <p className="text-sm text-surface-400">Overview of your exchange operations</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* TODO: Fetch real user count from GET /admin/metrics or GET /admin/users when endpoint exists */}
        <MetricCard
          title="Total Users"
          value="24,831"
          change={4.2}
          chartData={userGrowthMini}
          chartColor="#10b981"
          icon={<Users className="h-5 w-5" />}
        />
        {/* TODO: Fetch real 24h volume from GET /admin/metrics */}
        <MetricCard
          title="24h Volume"
          value={formatCurrency(68_900_000)}
          change={-4.8}
          chartData={volumeMini}
          chartColor="#29a3ff"
          icon={<Activity className="h-5 w-5" />}
        />
        {/* TODO: Fetch real active orders from GET /admin/metrics */}
        <MetricCard
          title="Active Orders"
          value={formatCompact(4_128)}
          change={5.3}
          chartData={ordersMini}
          chartColor="#8b5cf6"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        {/* TODO: Fetch pending withdrawals from GET /admin/metrics */}
        <MetricCard
          title="Pending Withdrawals"
          value="37"
          icon={<CreditCard className="h-5 w-5" />}
        />
        {/* TODO: Fetch real 24h revenue from GET /admin/metrics */}
        <MetricCard
          title="24h Revenue"
          value={formatCurrency(165_400)}
          change={8.2}
          chartData={revenueMini}
          chartColor="#f59e0b"
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      {/* Real data summary */}
      {pairCount !== null && (
        <div className="card flex items-center gap-4">
          <Badge variant="info">Live</Badge>
          <span className="text-sm text-surface-300">
            <strong className="text-surface-100">{pairCount}</strong> trading pairs loaded from backend
          </span>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* TODO: Replace volumeHistory with real data from GET /admin/metrics when available */}
        <div className="xl:col-span-2">
          <VolumeChart data={volumeHistory} />
        </div>

        {/* Revenue Chart — TODO: Replace with real revenue data from GET /admin/metrics */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Revenue Trend</h3>
            <p className="text-xs text-surface-500">Daily fee revenue</p>
          </div>
          <div className="mb-4">
            <span className="text-2xl font-bold text-surface-50">
              {formatCurrency(165_400)}
            </span>
            <span className="ml-2 text-xs text-emerald-400">+8.2%</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Recent Activity — TODO: Wire to GET /notifications or GET /admin/activity */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-100">Recent Activity</h3>
            <button className="text-xs text-novex-400 hover:text-novex-300">View all</button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-surface-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={item.type} dot>
                    {item.action}
                  </Badge>
                  <span className="text-xs text-surface-400">{item.user}</span>
                </div>
                <span className="text-xs text-surface-500">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Overview — TODO: Wire to GET /admin/metrics for real KYC stats */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Compliance Overview</h3>
            <p className="text-xs text-surface-500">KYC and verification stats</p>
          </div>
          <div className="space-y-4">
            {[
              { label: "Pending KYC Reviews", value: "23", variant: "warning" as const, icon: <Shield className="h-4 w-4" /> },
              { label: "Unverified Users", value: "1,247", variant: "danger" as const, icon: <Users className="h-4 w-4" /> },
              { label: "Basic Tier", value: "15,832", variant: "info" as const, icon: <Users className="h-4 w-4" /> },
              { label: "Advanced Tier", value: "6,504", variant: "success" as const, icon: <Users className="h-4 w-4" /> },
              { label: "Institutional", value: "1,248", variant: "success" as const, icon: <Users className="h-4 w-4" /> },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-lg border border-surface-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-surface-500">{stat.icon}</div>
                  <span className="text-sm text-surface-300">{stat.label}</span>
                </div>
                <Badge variant={stat.variant}>{stat.value}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
