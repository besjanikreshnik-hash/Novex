"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Settings,
  User,
  Wallet,
  BarChart3,
  TrendingUp,
  LayoutGrid,
  ClipboardList,
  Users,
  LifeBuoy,
  Bell,
  PieChart,
  Coins,
  ArrowLeftRight,
  Crown,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTranslation } from "@/lib/i18n/context";
import type { Translation } from "@/lib/i18n/translations";

const navLinks: { href: string; labelKey: keyof Translation; icon: typeof TrendingUp }[] = [
  { href: "/convert", labelKey: "nav_convert", icon: ArrowLeftRight },
  { href: "/trade", labelKey: "nav_trade", icon: TrendingUp },
  { href: "/portfolio", labelKey: "nav_portfolio", icon: PieChart },
  { href: "/markets", labelKey: "nav_markets", icon: LayoutGrid },
  { href: "/history", labelKey: "nav_history", icon: ClipboardList },
  { href: "/wallet", labelKey: "nav_wallet", icon: Wallet },
  { href: "/earn", labelKey: "nav_earn", icon: Coins },
  { href: "/p2p", labelKey: "nav_p2p", icon: Users },
  { href: "/fees", labelKey: "nav_fees", icon: Crown },
  { href: "/leaderboard", labelKey: "nav_leaderboard", icon: Trophy },
  { href: "/alerts", labelKey: "nav_alerts", icon: Bell },
  { href: "/referral", labelKey: "nav_referral", icon: Users },
  { href: "/support", labelKey: "nav_support", icon: LifeBuoy },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  // Prevent hydration mismatch — auth state comes from localStorage
  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="h-14 bg-dark-900 border-b border-border flex items-center px-4 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/trade" className="flex items-center gap-2 mr-8">
        <div className="w-8 h-8 rounded-lg bg-novex-primary flex items-center justify-center">
          <BarChart3 size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-text-primary tracking-tight">
          Nov<span className="text-novex-primary">Ex</span>
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-novex-primary bg-novex-primary-light"
                  : "text-text-secondary hover:text-text-primary hover:bg-dark-700"
              )}
            >
              <link.icon size={16} />
              {t(link.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Language Selector */}
        <LanguageSelector compact />

        {/* Notifications */}
        <NotificationBell />

        {/* Profile — guard with mounted to prevent hydration mismatch */}
        {mounted && isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-novex-primary/20 flex items-center justify-center">
                <User size={14} className="text-novex-primary" />
              </div>
              <span className="text-sm text-text-secondary max-w-[120px] truncate">
                {user?.email ?? "User"}
              </span>
              <ChevronDown size={14} className="text-text-tertiary" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-border rounded-xl shadow-2xl py-1 animate-slide-down">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-dark-700 transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={14} />
                  {t('nav_settings')}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setProfileOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-novex-danger hover:bg-dark-700 transition-colors"
                >
                  <LogOut size={14} />
                  {t('auth_sign_out')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('auth_login')}
            </Link>
            <Link
              href="/register"
              className="px-3 py-1.5 text-sm font-medium text-white bg-novex-primary hover:bg-novex-primary-hover rounded-lg transition-colors"
            >
              {t('auth_sign_up')}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
