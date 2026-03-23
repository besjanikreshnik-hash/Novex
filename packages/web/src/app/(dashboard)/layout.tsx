'use client';

import { Navbar } from '@/components/layout/Navbar';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { useWsConnection } from '@/hooks/useWebSocket';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const wsState = useWsConnection();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {/* Connection status bar */}
      {wsState !== 'connected' && (
        <div className="bg-nvx-bg-tertiary border-b border-nvx-border px-4 py-1 flex items-center justify-center">
          <ConnectionStatus state={wsState} />
        </div>
      )}
      <main className="flex-1">{children}</main>
      {/* Persistent status indicator in corner */}
      <div className="fixed bottom-3 right-3 z-50">
        <ConnectionStatus state={wsState} />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardInner>{children}</DashboardInner>
    </AuthGuard>
  );
}
