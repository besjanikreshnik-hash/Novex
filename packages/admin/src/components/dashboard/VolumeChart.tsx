"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/utils";

interface VolumeChartProps {
  data: { date: string; volume: number }[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 shadow-xl">
      <p className="text-xs text-surface-400">{label}</p>
      <p className="text-sm font-semibold text-surface-100">
        ${formatCompact(payload[0].value)}
      </p>
    </div>
  );
}

export function VolumeChart({ data }: VolumeChartProps) {
  return (
    <div className="card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-surface-100">Trading Volume</h3>
          <p className="text-xs text-surface-500">Last 7 days</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-surface-700 p-0.5">
          <button className="rounded-md bg-surface-700 px-3 py-1 text-xs font-medium text-surface-200">
            7D
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-surface-500 hover:text-surface-300">
            30D
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-surface-500 hover:text-surface-300">
            90D
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
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
              tickFormatter={(v: number) => `$${formatCompact(v)}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="volume" fill="#1183f5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default VolumeChart;
