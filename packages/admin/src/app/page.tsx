"use client";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { Badge } from "@/components/ui/Badge";
import { marketApi } from "@/lib/api";
import { formatCompact, formatCurrency } from "@/lib/utils";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Database,
  DollarSign,
  Server,
  Shield,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

// TODO: Replace with real data from GET /admin/metrics — volume by pair
const volumeByPair = [
  { pair: "BTC/USDT", volume: 42_500_000 },
  { pair: "ETH/USDT", volume: 18_200_000 },
  { pair: "SOL/USDT", volume: 8_200_000 },
];

// TODO: Replace with real data — user growth (mock daily registrations)
const userGrowthDaily = [
  { date: "Mar 16", users: 142 },
  { date: "Mar 17", users: 158 },
  { date: "Mar 18", users: 175 },
  { date: "Mar 19", users: 131 },
  { date: "Mar 20", users: 168 },
  { date: "Mar 21", users: 192 },
  { date: "Mar 22", users: 185 },
];

function PairVolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 shadow-xl">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-100">${formatCompact(payload[0].value)}</p>
    </div>
  );
}

function UserGrowthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 shadow-xl">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-100">{payload[0].value} new users</p>
    </div>
  );
}

export default function DashboardPage() {
  // Real data from backend
  const [pairCount, setPairCount] = useState<number | null>(null);
  const [pairs, setPairs] = useState<Array<{ symbol: string; baseCurrency: string; quoteCurrency: string }>>([]);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");

  useEffect(() => {
    // Fetch real trading pair data from GET /market/pairs
    marketApi.getPairs()
      .then((pairData) => {
        setPairCount(pairData.length);
        setPairs(pairData.map(p => ({ symbol: p.symbol, baseCurrency: p.baseCurrency, quoteCurrency: p.quoteCurrency })));
        setBackendStatus("online");
      })
      .catch(() => {
        setPairCount(null);
        setBackendStatus("offline");
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Dashboard</h1>
          <p className="text-sm text-surface-400">Overview of your exchange operations</p>
        </div>
        <Link
          href="/analytics"
          className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
        >
          <Activity className="h-4 w-4" />
          Advanced Analytics
        </Link>
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
        {/* TODO: Fetch real 24h revenue from fee_ledger if accessible */}
        <MetricCard
          title="24h Revenue"
          value={formatCurrency(165_400)}
          change={8.2}
          chartData={revenueMini}
          chartColor="#f59e0b"
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      {/* Real data summary + System Health */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {pairCount !== null && (
          <div className="card flex items-center gap-4">
            <Badge variant="info">Live</Badge>
            <span className="text-sm text-surface-300">
              <strong className="text-surface-100">{pairCount}</strong> trading pairs loaded from backend
              {pairs.length > 0 && (
                <span className="text-surface-500 ml-2">
                  ({pairs.map(p => `${p.baseCurrency}/${p.quoteCurrency}`).join(", ")})
                </span>
              )}
            </span>
          </div>
        )}

        {/* System Health Indicators */}
        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">System Health</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-surface-500" />
              <span className="text-xs text-surface-400">Backend</span>
              {backendStatus === "checking" ? (
                <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              ) : backendStatus === "online" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-surface-500" />
              <span className="text-xs text-surface-400">Database</span>
              {/* TODO: Add real DB health check via GET /health */}
              {backendStatus === "online" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-surface-600" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-surface-500" />
              <span className="text-xs text-surface-400">Redis</span>
              {/* TODO: Add real Redis health check via GET /health */}
              <span className="h-2 w-2 rounded-full bg-surface-600" title="Not checked" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* TODO: Replace volumeHistory with real data from GET /admin/metrics when available */}
        <div className="xl:col-span-2">
          <VolumeChart data={volumeHistory} />
        </div>

        {/* Revenue Chart — TODO: Replace with real revenue data from fee_ledger */}
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

      {/* Volume by Pair + User Growth */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Volume by Pair — TODO: Replace with real data from GET /admin/metrics */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Volume by Trading Pair</h3>
            <p className="text-xs text-surface-500">24h volume distribution</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeByPair} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="pair"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(v: number) => `$${formatCompact(v)}`}
                />
                <Tooltip content={<PairVolumeTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth Chart — TODO: Replace with real registration data */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">User Growth</h3>
            <p className="text-xs text-surface-500">Daily new registrations</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowthDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip content={<UserGrowthTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <defs>
                  <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#userGrowthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 5 Pairs Table */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-100">Top Pairs by Volume</h3>
            <p className="text-xs text-surface-500">24h trading volume ranking</p>
          </div>
        </div>
        {/* TODO: Replace with real data from GET /admin/metrics or trading aggregation */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800 text-surface-500 text-xs">
                <th className="text-left py-2 px-3 font-medium">#</th>
                <th className="text-left py-2 px-3 font-medium">Pair</th>
                <th className="text-right py-2 px-3 font-medium">24h Volume</th>
                <th className="text-right py-2 px-3 font-medium">Trades</th>
                <th className="text-right py-2 px-3 font-medium">Fees Collected</th>
              </tr>
            </thead>
            <tbody>
              {[
                { rank: 1, pair: "BTC/USDT", volume: 42_500_000, trades: 15_234, fees: 42_500 },
                { rank: 2, pair: "ETH/USDT", volume: 18_200_000, trades: 8_912, fees: 18_200 },
                { rank: 3, pair: "SOL/USDT", volume: 8_200_000, trades: 4_156, fees: 8_200 },
                { rank: 4, pair: "BNB/USDT", volume: 3_100_000, trades: 1_823, fees: 3_100 },
                { rank: 5, pair: "XRP/USDT", volume: 1_800_000, trades: 987, fees: 1_800 },
              ].map((row) => (
                <tr key={row.rank} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                  <td className="py-2.5 px-3 text-xs text-surface-500">{row.rank}</td>
                  <td className="py-2.5 px-3 text-sm font-medium text-surface-200">{row.pair}</td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono text-surface-200">
                    {formatCurrency(row.volume)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono text-surface-400">
                    {row.trades.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-mono text-emerald-400">
                    {formatCurrency(row.fees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
