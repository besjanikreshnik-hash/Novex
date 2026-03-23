'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  LogIn,
  LogOut,
  Key,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  XCircle,
  ArrowUpRight,
  Settings,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ────────────────────────────────────────── */

interface ActivityItem {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'password_change', label: 'Password Change' },
  { value: '2fa_enable', label: '2FA Enable' },
  { value: '2fa_disable', label: '2FA Disable' },
  { value: 'order_placed', label: 'Order Placed' },
  { value: 'order_cancelled', label: 'Order Cancelled' },
  { value: 'withdrawal_request', label: 'Withdrawal Request' },
  { value: 'api_key_created', label: 'API Key Created' },
  { value: 'settings_change', label: 'Settings Change' },
];

const ACTION_CONFIG: Record<string, { icon: typeof LogIn; label: string; color: string }> = {
  login: { icon: LogIn, label: 'Login', color: 'text-nvx-primary' },
  logout: { icon: LogOut, label: 'Logout', color: 'text-nvx-text-muted' },
  password_change: { icon: Key, label: 'Password Changed', color: 'text-yellow-400' },
  '2fa_enable': { icon: ShieldCheck, label: '2FA Enabled', color: 'text-nvx-buy' },
  '2fa_disable': { icon: ShieldOff, label: '2FA Disabled', color: 'text-nvx-sell' },
  order_placed: { icon: ShoppingCart, label: 'Order Placed', color: 'text-nvx-primary' },
  order_cancelled: { icon: XCircle, label: 'Order Cancelled', color: 'text-nvx-sell' },
  withdrawal_request: { icon: ArrowUpRight, label: 'Withdrawal', color: 'text-yellow-400' },
  api_key_created: { icon: Key, label: 'API Key Created', color: 'text-nvx-primary' },
  settings_change: { icon: Settings, label: 'Settings Changed', color: 'text-nvx-text-secondary' },
};

const PAGE_SIZE = 20;

/* ─── Browser Parser ──────────────────────────────── */

function parseBrowser(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Other';
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Mobile') || ua.includes('Android')) return 'Mobile';
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablet';
  return 'Desktop';
}

/* ─── Main Page ───────────────────────────────────── */

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('novex_access_token')
          : null;
      if (!token) return;

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/account/activity?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [actionFilter]);

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-nvx-text-muted hover:text-nvx-text-secondary transition-colors mb-3"
          >
            <ChevronLeft size={14} />
            Back to Settings
          </Link>
          <h1 className="text-xl font-bold text-nvx-text-primary">Account Activity</h1>
          <p className="text-sm text-nvx-text-muted mt-1">
            Full log of all account actions ({total} total)
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="appearance-none px-3 py-2 pr-8 bg-nvx-bg-secondary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nvx-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[180px_1fr_140px_140px] gap-4 px-5 py-3 border-b border-nvx-border text-xs font-semibold text-nvx-text-muted uppercase tracking-wider">
            <span>Date</span>
            <span>Action</span>
            <span>IP Address</span>
            <span>Device / Browser</span>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-nvx-primary border-t-transparent" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity size={24} className="text-nvx-text-muted mx-auto mb-2" />
              <p className="text-sm text-nvx-text-muted">No activity found</p>
            </div>
          ) : (
            activities.map((item) => {
              const config = ACTION_CONFIG[item.action] ?? {
                icon: Activity,
                label: item.action,
                color: 'text-nvx-text-muted',
              };
              const ActionIcon = config.icon;
              const browser = parseBrowser(item.userAgent);
              const device = parseDevice(item.userAgent);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[180px_1fr_140px_140px] gap-4 px-5 py-3 border-b border-nvx-border/50 hover:bg-nvx-bg-primary/30 transition-colors items-center"
                >
                  {/* Date */}
                  <span className="text-xs text-nvx-text-secondary">
                    {new Date(item.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>

                  {/* Action */}
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-6 h-6 rounded flex items-center justify-center bg-nvx-bg-primary', config.color)}>
                      <ActionIcon size={13} />
                    </div>
                    <span className="text-sm text-nvx-text-primary">{config.label}</span>
                  </div>

                  {/* IP */}
                  <span className="text-xs text-nvx-text-muted font-mono">{item.ipAddress ?? '--'}</span>

                  {/* Device */}
                  <div className="flex items-center gap-1.5 text-xs text-nvx-text-muted">
                    <Monitor size={12} />
                    <span>{device} / {browser}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-nvx-text-muted">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-nvx-border bg-nvx-bg-secondary text-nvx-text-secondary hover:bg-nvx-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-nvx-border bg-nvx-bg-secondary text-nvx-text-secondary hover:bg-nvx-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
