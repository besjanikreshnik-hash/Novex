import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'card' | 'chart' | 'table-row';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  count?: number;
}

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-nvx-bg-tertiary',
        className,
      )}
    />
  );
}

export function Skeleton({ variant = 'text', className, count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count });

  switch (variant) {
    case 'text':
      return (
        <>
          {items.map((_, i) => (
            <SkeletonBase key={i} className={cn('h-4 w-full', i > 0 && 'mt-2', className)} />
          ))}
        </>
      );

    case 'card':
      return (
        <>
          {items.map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5',
                className,
              )}
            >
              <SkeletonBase className="h-3 w-24 mb-3" />
              <SkeletonBase className="h-7 w-40 mb-2" />
              <SkeletonBase className="h-3 w-32" />
            </div>
          ))}
        </>
      );

    case 'chart':
      return (
        <div
          className={cn(
            'bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden',
            className,
          )}
        >
          <div className="p-4 border-b border-nvx-border flex items-center gap-3">
            <SkeletonBase className="h-4 w-20" />
            <SkeletonBase className="h-4 w-16" />
          </div>
          <div className="p-4">
            <SkeletonBase className="h-[200px] w-full rounded-lg" />
          </div>
        </div>
      );

    case 'table-row':
      return (
        <>
          {items.map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-4 px-4 py-3 border-b border-nvx-border/30',
                className,
              )}
            >
              <SkeletonBase className="h-8 w-8 rounded-full flex-shrink-0" />
              <SkeletonBase className="h-4 w-20" />
              <div className="flex-1" />
              <SkeletonBase className="h-4 w-16" />
              <SkeletonBase className="h-4 w-16" />
              <SkeletonBase className="h-4 w-20" />
            </div>
          ))}
        </>
      );

    default:
      return <SkeletonBase className={className} />;
  }
}
