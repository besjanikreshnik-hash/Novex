'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken } from '@/lib/api';

/**
 * Client-side auth guard. Wraps protected pages.
 * Redirects to /login if no token is present.
 * Uses mounted state to prevent hydration mismatch.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialize } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!mounted) return;
    const token = getAccessToken();
    if (!token && !user) {
      router.replace('/login');
    }
  }, [user, router, mounted]);

  // Always render loading on server and before mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-nvx-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-nvx-primary border-t-transparent" />
      </div>
    );
  }

  const token = getAccessToken();
  if (!token && !user) {
    return (
      <div className="min-h-screen bg-nvx-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-nvx-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
