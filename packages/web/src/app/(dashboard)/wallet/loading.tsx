import { Skeleton } from '@/components/ui/Skeleton';

export default function WalletLoading() {
  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-7 w-24 mb-2" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-9 w-9" />
            <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-9 w-9" />
          </div>
        </div>

        {/* Portfolio Value Card */}
        <Skeleton variant="card" className="mb-6" />

        {/* Filters */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="p-4 flex items-center gap-3 border-b border-nvx-border">
            <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-9 w-64" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-40" />
          </div>

          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-nvx-border">
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-12" />
            <div className="flex-1" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-16" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-14" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-12" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-16" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-16" />
          </div>

          {/* Table Rows */}
          <Skeleton variant="table-row" count={6} />
        </div>
      </div>
    </div>
  );
}
