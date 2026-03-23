import { Skeleton } from '@/components/ui/Skeleton';

export default function TradeLoading() {
  return (
    <div className="h-[calc(100vh-56px)] bg-nvx-bg-primary flex flex-col overflow-hidden">
      {/* Top Bar Skeleton */}
      <div className="flex-shrink-0 bg-nvx-bg-secondary border-b border-nvx-border px-4 py-2 flex items-center gap-6">
        <div className="animate-pulse rounded bg-nvx-bg-tertiary h-8 w-32" />
        <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-24" />
        <div className="flex gap-4">
          <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-16" />
          <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-16" />
          <div className="animate-pulse rounded bg-nvx-bg-tertiary h-4 w-20" />
        </div>
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_280px_300px] grid-rows-[1fr_240px] gap-px">
        {/* Chart Area */}
        <div className="bg-nvx-bg-secondary p-4">
          <div className="animate-pulse rounded-lg bg-nvx-bg-tertiary h-full w-full" />
        </div>

        {/* Order Book Area */}
        <div className="bg-nvx-bg-secondary border-l border-nvx-border p-3">
          <div className="flex gap-2 mb-3">
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-20" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-16" />
          </div>
          <Skeleton variant="table-row" count={8} />
        </div>

        {/* Order Form Area */}
        <div className="bg-nvx-bg-secondary border-l border-nvx-border p-4 row-span-2">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="animate-pulse rounded bg-nvx-bg-tertiary h-9 flex-1" />
              <div className="animate-pulse rounded bg-nvx-bg-tertiary h-9 flex-1" />
            </div>
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-10 w-full" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-10 w-full" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-10 w-full" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-12 w-full" />
          </div>
        </div>

        {/* Bottom Orders Panel */}
        <div className="col-span-2 bg-nvx-bg-secondary border-t border-nvx-border p-3">
          <div className="flex gap-4 mb-3">
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-24" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-28" />
            <div className="animate-pulse rounded bg-nvx-bg-tertiary h-6 w-28" />
          </div>
          <Skeleton variant="table-row" count={4} />
        </div>
      </div>
    </div>
  );
}
