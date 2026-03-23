'use client';

import { cn } from '@/lib/utils';
import type { ConnectionState } from '@/hooks/useWebSocket';

const stateConfig: Record<ConnectionState, { color: string; label: string; pulse: boolean }> = {
  connected:     { color: 'bg-nvx-buy',      label: 'Live',          pulse: false },
  connecting:    { color: 'bg-nvx-warning',   label: 'Connecting',    pulse: true },
  reconnecting:  { color: 'bg-nvx-warning',   label: 'Reconnecting',  pulse: true },
  disconnected:  { color: 'bg-nvx-sell',      label: 'Disconnected',  pulse: false },
};

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const config = stateConfig[state];

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', config.color)} />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', config.color)} />
      </span>
      <span className="text-[10px] text-nvx-text-muted font-medium uppercase tracking-wider">
        {config.label}
      </span>
    </div>
  );
}
