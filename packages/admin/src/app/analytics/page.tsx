"use client";

import { formatCompact, formatCurrency } from "@/lib/utils";
import { useState } from "react";

// ─── Mock data with TODO markers ───────────────────────────────────────────────
// TODO: Replace all mock data with real backend data from GET /admin/analytics

const volumeByPairData = [
  { pair: "BTC/USDT", volume: 42_500_000 },
  { pair: "ETH/USDT", volume: 18_200_000 },
  { pair: "SOL/USDT", volume: 8_200_000 },
  { pair: "BNB/USDT", volume: 3_100_000 },
  { pair: "XRP/USDT", volume: 1_800_000 },
  { pair: "DOGE/USDT", volume: 950_000 },
  { pair: "ADA/USDT", volume: 720_000 },
];

const volumeByHourData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, "0")}:00`,
  volume: Math.floor(1_000_000 + Math.random() * 4_000_000),
}));

const userRegistrationTrend = [
  { date: "Mar 1", users: 95 },
  { date: "Mar 3", users: 108 },
  { date: "Mar 5", users: 122 },
  { date: "Mar 7", users: 135 },
  { date: "Mar 9", users: 118 },
  { date: "Mar 11", users: 142 },
  { date: "Mar 13", users: 158 },
  { date: "Mar 15", users: 175 },
  { date: "Mar 17", users: 168 },
  { date: "Mar 19", users: 192 },
  { date: "Mar 21", users: 185 },
  { date: "Mar 23", users: 205 },
];

const orderTypeDistribution = [
  { type: "Market Buy", count: 12_450, color: "#10b981" },
  { type: "Market Sell", count: 11_230, color: "#ef4444" },
  { type: "Limit Buy", count: 8_920, color: "#22c55e" },
  { type: "Limit Sell", count: 7_840, color: "#f87171" },
  { type: "Stop-Loss", count: 2_130, color: "#f59e0b" },
];

const feeRevenueBreakdown = [
  { source: "Spot Trading (Taker)", amount: 89_200, pct: 54 },
  { source: "Spot Trading (Maker)", amount: 42_800, pct: 26 },
  { source: "Withdrawal Fees", amount: 18_500, pct: 11 },
  { source: "Futures Trading", amount: 12_300, pct: 7 },
  { source: "P2P Escrow Fees", amount: 3_200, pct: 2 },
];

// ─── SVG Chart Components ──────────────────────────────────────────────────────

function BarChartSVG({ data, dataKey, labelKey, color = "#8b5cf6", height = 220 }: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[dataKey])));
  const barWidth = Math.max(20, Math.floor((600 - data.length * 4) / data.length));
  const chartWidth = data.length * (barWidth + 4) + 60;
  const chartHeight = height;
  const plotHeight = chartHeight - 40;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ maxHeight: height }}>
      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <g key={pct}>
          <line
            x1="55" y1={plotHeight - pct * plotHeight + 10}
            x2={chartWidth} y2={plotHeight - pct * plotHeight + 10}
            stroke="#1e293b" strokeDasharray="3 3"
          />
          <text
            x="50" y={plotHeight - pct * plotHeight + 14}
            textAnchor="end" fill="#64748b" fontSize="10"
          >
            ${formatCompact(maxVal * pct)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const val = Number(d[dataKey]);
        const barH = (val / maxVal) * plotHeight;
        const x = 60 + i * (barWidth + 4);
        return (
          <g key={i}>
            <rect
              x={x} y={plotHeight - barH + 10}
              width={barWidth} height={barH}
              fill={color} rx="3" opacity="0.85"
            />
            <text
              x={x + barWidth / 2} y={chartHeight - 2}
              textAnchor="middle" fill="#64748b" fontSize="9"
            >
              {String(d[labelKey]).length > 8 ? String(d[labelKey]).slice(0, 8) : String(d[labelKey])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChartSVG({ data, dataKey, labelKey, color = "#10b981", height = 220 }: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[dataKey])));
  const minVal = Math.min(...data.map((d) => Number(d[dataKey])));
  const range = maxVal - minVal || 1;
  const chartWidth = 640;
  const chartHeight = height;
  const plotWidth = chartWidth - 70;
  const plotHeight = chartHeight - 40;
  const stepX = plotWidth / (data.length - 1);

  const points = data.map((d, i) => {
    const x = 60 + i * stepX;
    const y = 10 + plotHeight - ((Number(d[dataKey]) - minVal) / range) * plotHeight;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${plotHeight + 10} L ${points[0].x} ${plotHeight + 10} Z`;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ maxHeight: height }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <g key={pct}>
          <line
            x1="55" y1={10 + plotHeight - pct * plotHeight}
            x2={chartWidth} y2={10 + plotHeight - pct * plotHeight}
            stroke="#1e293b" strokeDasharray="3 3"
          />
          <text
            x="50" y={14 + plotHeight - pct * plotHeight}
            textAnchor="end" fill="#64748b" fontSize="10"
          >
            {Math.round(minVal + range * pct)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id={`lineGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#lineGrad-${color})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}

      {/* X labels */}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={60 + i * stepX}
            y={chartHeight - 2}
            textAnchor="middle" fill="#64748b" fontSize="9"
          >
            {String(d[labelKey])}
          </text>
        );
      })}
    </svg>
  );
}

function PieChartSVG({ data, height = 220 }: {
  data: Array<{ type: string; count: number; color: string }>;
  height?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const cx = 110;
  const cy = 110;
  const r = 90;
  let currentAngle = -Math.PI / 2;

  const slices = data.map((d) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(currentAngle);
    const startY = cy + r * Math.sin(currentAngle);
    const endX = cx + r * Math.cos(currentAngle + angle);
    const endY = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
    currentAngle += angle;
    return { ...d, path, pct: ((d.count / total) * 100).toFixed(1) };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 220 220" className="shrink-0" style={{ width: height, height }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.85" stroke="#0b1120" strokeWidth="2" />
        ))}
        {/* Center hole for donut */}
        <circle cx={cx} cy={cy} r="50" fill="#0b1120" />
        <text x={cx} y={cy - 5} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="10">
          orders
        </text>
      </svg>
      <div className="space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-surface-400">{s.type}</span>
            <span className="text-xs font-mono text-surface-300">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("7d");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Analytics</h1>
          <p className="text-sm text-surface-400">
            Detailed exchange metrics and insights
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-1 rounded-lg border border-surface-700 p-0.5">
          {(["7d", "30d", "90d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                dateRange === range
                  ? "bg-surface-700 text-surface-200"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Volume by Pair (Bar Chart) */}
      {/* TODO: Replace with real data from GET /admin/analytics?range={dateRange} */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-surface-100">Volume by Trading Pair</h3>
          <p className="text-xs text-surface-500">
            Total trading volume per pair ({dateRange} window)
          </p>
        </div>
        <BarChartSVG
          data={volumeByPairData}
          dataKey="volume"
          labelKey="pair"
          color="#8b5cf6"
          height={240}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Volume by Hour (Line Chart) */}
        {/* TODO: Replace with real hourly volume data from GET /admin/analytics/hourly */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Volume by Hour</h3>
            <p className="text-xs text-surface-500">Average hourly trading volume</p>
          </div>
          <LineChartSVG
            data={volumeByHourData}
            dataKey="volume"
            labelKey="hour"
            color="#29a3ff"
            height={220}
          />
        </div>

        {/* User Registration Trend (Line Chart) */}
        {/* TODO: Replace with real user registration data from GET /admin/analytics/users */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">User Registration Trend</h3>
            <p className="text-xs text-surface-500">New registrations per day</p>
          </div>
          <LineChartSVG
            data={userRegistrationTrend}
            dataKey="users"
            labelKey="date"
            color="#10b981"
            height={220}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Order Type Distribution (Pie Chart) */}
        {/* TODO: Replace with real order type data from GET /admin/analytics/orders */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Order Type Distribution</h3>
            <p className="text-xs text-surface-500">Breakdown of order types ({dateRange})</p>
          </div>
          <PieChartSVG data={orderTypeDistribution} height={220} />
        </div>

        {/* Fee Revenue Breakdown */}
        {/* TODO: Replace with real fee data from fee_ledger / GET /admin/analytics/fees */}
        <div className="card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-surface-100">Fee Revenue Breakdown</h3>
            <p className="text-xs text-surface-500">Revenue by source ({dateRange})</p>
          </div>
          <div className="space-y-3">
            {feeRevenueBreakdown.map((item) => (
              <div key={item.source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-surface-400">{item.source}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-surface-300">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[10px] text-surface-500">{item.pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-novex-500 transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between border-t border-surface-800 pt-3">
              <span className="text-sm font-medium text-surface-200">Total Revenue</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {formatCurrency(feeRevenueBreakdown.reduce((sum, d) => sum + d.amount, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      {/* TODO: Replace with real aggregated stats from GET /admin/analytics/summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Volume", value: formatCurrency(74_700_000), change: "+12.4%" },
          { label: "Total Trades", value: "42,570", change: "+8.1%" },
          { label: "Unique Traders", value: "3,842", change: "+15.2%" },
          { label: "Avg Trade Size", value: formatCurrency(1_755), change: "-2.3%" },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-surface-500 mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-surface-50 font-mono">{stat.value}</p>
            <p className={`text-xs mt-1 ${stat.change.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
              {stat.change} vs prev period
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
