"use client";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { Bell, ChevronDown, LogOut, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const breadcrumbMap: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/kyc": "KYC Review",
  "/withdrawals": "Withdrawals",
  "/pairs": "Trading Pairs",
  "/audit": "Audit Logs",
  "/announcements": "Announcements",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
    router.replace('/login');
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD';

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = [
    { label: "Dashboard", href: "/" },
    ...segments.map((segment, i) => {
      const href = "/" + segments.slice(0, i + 1).join("/");
      return {
        label: breadcrumbMap[href] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
        href,
      };
    }),
  ];

  // Deduplicate if on dashboard
  if (pathname === "/") {
    breadcrumbs.splice(1);
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-800 bg-surface-900/80 px-6 backdrop-blur-sm">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-surface-600">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-surface-100">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-surface-400 hover:text-surface-200">
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="flex h-9 items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 text-sm text-surface-500 transition-colors hover:border-surface-600 hover:text-surface-400">
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Search...</span>
          <kbd className="hidden rounded border border-surface-700 bg-surface-900 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 md:inline">
            /
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown((p) => !p)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-800"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-novex-600/20 text-xs font-bold text-novex-400">
              {initials}
            </div>
            <span className="hidden text-surface-300 md:inline">{user?.email ?? 'Admin'}</span>
            <ChevronDown className="h-4 w-4 text-surface-500" />
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-48 animate-fade-in rounded-lg border border-surface-700 bg-surface-800 py-1 shadow-xl">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100"
                  onClick={() => setShowDropdown(false)}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100"
                  onClick={() => setShowDropdown(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <hr className="my-1 border-surface-700" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-surface-700"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
