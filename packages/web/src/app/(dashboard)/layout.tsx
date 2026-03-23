'use client';

import { useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { useWsConnection } from '@/hooks/useWebSocket';
import { getAccessToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Request browser notification permission and register the push
 * subscription with the backend. Runs once when the dashboard mounts.
 */
async function registerWebPush(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // In production, replace this with your real VAPID public key
      // For now we try to subscribe; it will fail without a valid key
      // and that is expected during development.
      subscription = await registration.pushManager
        .subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
        })
        .catch(() => null);
    }

    if (!subscription) return;

    const token = getAccessToken();
    if (!token) return;

    await fetch(`${API_URL}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        token: JSON.stringify(subscription),
        platform: 'web',
        deviceName: navigator.userAgent.slice(0, 100),
      }),
    });
  } catch {
    // Push registration is best-effort; do not break the app
  }
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const wsState = useWsConnection();

  // Register for web push notifications
  useEffect(() => {
    registerWebPush();
  }, []);

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
