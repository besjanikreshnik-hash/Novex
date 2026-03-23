'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getAccessToken } from '@/lib/api';

/**
 * Client-side auth guard for admin pages.
 * Redirects to /login if no token is present.
 * Skips guard on the /login route itself.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, initialize } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!mounted) return;
    // Don't redirect if already on login page
    if (pathname === '/login') return;

    const token = getAccessToken();
    if (!token && !user) {
      router.replace('/login');
    }
  }, [user, router, mounted, pathname]);

  // Always render loading on server and before mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-novex-500 border-t-transparent" />
      </div>
    );
  }

  // On login page, always render children (the login form)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const token = getAccessToken();
  if (!token && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-novex-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
