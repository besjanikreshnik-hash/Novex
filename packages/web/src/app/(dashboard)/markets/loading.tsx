import { Skeleton } from '@/components/ui/Skeleton';

export default function MarketsLoading() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-nvx-bg-primary">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <div className="animate-pulse rounded bg-nvx-bg-tertiary h-8 w-32 mb-2" />
        <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-72 mb-6" />

        {/* Search */}
        <div className="animate-pulse rounded-lg bg-nvx-bg-secondary border border-nvx-border h-10 w-full max-w-md" />
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-nvx-border">
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-12" />
            <div className="flex-1" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-20" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-20" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-20" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-3 w-14" />
          </div>

          {/* Table Rows */}
          <Skeleton variant="table-row" count={10} />
        </div>
      </div>
    </div>
  );
}
