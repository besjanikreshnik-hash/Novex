"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: "Analytics", href: "/analytics", icon: <Activity className="h-5 w-5" /> },
    ],
  },
  {
    title: "User Management",
    items: [
      { label: "Users", href: "/users", icon: <Users className="h-5 w-5" /> },
      { label: "KYC Review", href: "/kyc", icon: <Shield className="h-5 w-5" /> },
      { label: "Withdrawals", href: "/withdrawals", icon: <CreditCard className="h-5 w-5" /> },
    ],
  },
  {
    title: "Exchange",
    items: [
      { label: "Trading Pairs", href: "/pairs", icon: <BarChart3 className="h-5 w-5" /> },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit Logs", href: "/audit", icon: <ClipboardList className="h-5 w-5" /> },
      { label: "Announcements", href: "/announcements", icon: <Megaphone className="h-5 w-5" /> },
      { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-surface-800 bg-surface-900 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-surface-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-novex-600 font-bold text-white">
          N
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-surface-100">NovEx</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-surface-500">
              Admin Panel
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-surface-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-novex-600/10 text-novex-400"
                          : "text-surface-400 hover:bg-surface-800 hover:text-surface-200"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={cn("shrink-0", active && "text-novex-400")}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                      {active && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-novex-400" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-surface-700 bg-surface-800 text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
      >
        <ChevronLeft
          className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")}
        />
      </button>

      {/* Footer */}
      <div className="border-t border-surface-800 p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-700 text-xs font-bold text-surface-300">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-surface-200">Admin User</span>
              <span className="text-[10px] text-surface-500">Super Admin</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
