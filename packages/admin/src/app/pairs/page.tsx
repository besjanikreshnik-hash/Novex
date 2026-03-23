"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { marketApi, type TradingPairDto } from "@/lib/api";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Loader2, Plus, Power, PowerOff, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function PairsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ baseAsset: "", quoteAsset: "", minOrderSize: "", maxOrderSize: "", makerFee: "0.001", takerFee: "0.002" });

  // Real data fetching from GET /market/pairs
  const [pairs, setPairs] = useState<TradingPairDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketApi.getPairs();
      setPairs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading pairs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  const columns: ColumnDef<TradingPairDto, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "symbol",
        header: "Pair",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-surface-100">{row.original.baseCurrency}</span>
            <span className="text-surface-500">/</span>
            <span className="text-surface-300">{row.original.quoteCurrency}</span>
          </div>
        ),
      },
      {
        accessorKey: "makerFee",
        header: "Maker / Taker",
        cell: ({ row }) => (
          <span className="text-xs text-surface-300">
            {(Number(row.original.makerFee) * 100).toFixed(2)}% / {(Number(row.original.takerFee) * 100).toFixed(2)}%
          </span>
        ),
      },
      {
        accessorKey: "minQuantity",
        header: "Min Quantity",
        cell: ({ getValue }) => <span className="font-mono text-xs text-surface-400">{getValue<string>()}</span>,
      },
      {
        accessorKey: "pricePrecision",
        header: "Price Precision",
        cell: ({ getValue }) => <span className="text-xs text-surface-400">{getValue<number>()} decimals</span>,
      },
      {
        accessorKey: "quantityPrecision",
        header: "Qty Precision",
        cell: ({ getValue }) => <span className="text-xs text-surface-400">{getValue<number>()} decimals</span>,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ getValue }) => {
          const active = getValue<boolean>();
          return (
            <Badge variant={active ? "success" : "neutral"} dot>
              {active ? "Active" : "Disabled"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {/* TODO: Wire to PATCH /admin/pairs/:id when backend endpoint exists */}
            {row.original.isActive ? (
              <Button variant="ghost" size="sm" icon={<PowerOff className="h-4 w-4 text-red-400" />}>
                Disable
              </Button>
            ) : (
              <Button variant="ghost" size="sm" icon={<Power className="h-4 w-4 text-emerald-400" />}>
                Enable
              </Button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  const activePairs = pairs.filter((p) => p.isActive);
  const disabledPairs = pairs.filter((p) => !p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Trading Pairs</h1>
          <p className="text-sm text-surface-400">
            Manage trading pairs, fees, and order constraints
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchPairs}
            loading={loading}
          >
            Refresh
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
            Add Pair
          </Button>
        </div>
      </div>

      {/* Add Pair Form */}
      {showForm && (
        <div className="card animate-fade-in border-novex-500/30">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-surface-100">Add New Trading Pair</h3>
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={() => setShowForm(false)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Base Asset"
              placeholder="e.g., BTC"
              value={formData.baseAsset}
              onChange={(e) => setFormData({ ...formData, baseAsset: e.target.value.toUpperCase() })}
            />
            <Input
              label="Quote Asset"
              placeholder="e.g., USDT"
              value={formData.quoteAsset}
              onChange={(e) => setFormData({ ...formData, quoteAsset: e.target.value.toUpperCase() })}
            />
            <Input
              label="Min Order Size"
              placeholder="0.001"
              type="number"
              value={formData.minOrderSize}
              onChange={(e) => setFormData({ ...formData, minOrderSize: e.target.value })}
            />
            <Input
              label="Max Order Size"
              placeholder="1000"
              type="number"
              value={formData.maxOrderSize}
              onChange={(e) => setFormData({ ...formData, maxOrderSize: e.target.value })}
            />
            <Input
              label="Maker Fee"
              placeholder="0.001"
              type="number"
              step="0.001"
              value={formData.makerFee}
              onChange={(e) => setFormData({ ...formData, makerFee: e.target.value })}
            />
            <Input
              label="Taker Fee"
              placeholder="0.002"
              type="number"
              step="0.001"
              value={formData.takerFee}
              onChange={(e) => setFormData({ ...formData, takerFee: e.target.value })}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            {/* TODO: Wire to POST /admin/pairs when backend endpoint exists */}
            <Button>Create Pair</Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="card flex items-center gap-3 border-red-500/30">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
            <button
              className="mt-1 text-xs text-surface-400 hover:text-surface-200"
              onClick={fetchPairs}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-novex-400" />
          <span className="ml-3 text-sm text-surface-400">Loading trading pairs...</span>
        </div>
      )}

      {/* Stats */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card flex items-center justify-between">
              <span className="text-sm text-surface-400">Total Pairs</span>
              <span className="text-lg font-bold text-surface-100">{pairs.length}</span>
            </div>
            <div className="card flex items-center justify-between">
              <span className="text-sm text-surface-400">Active</span>
              <Badge variant="success">{activePairs.length}</Badge>
            </div>
            <div className="card flex items-center justify-between">
              <span className="text-sm text-surface-400">Disabled</span>
              <Badge variant="neutral">{disabledPairs.length}</Badge>
            </div>
          </div>

          <DataTable columns={columns} data={pairs} pageSize={10} />
        </>
      )}
    </div>
  );
}
