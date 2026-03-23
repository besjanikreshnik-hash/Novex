import { useEffect } from "react";
import { usePopupStore } from "@/stores/popup.store";
import { PortfolioView } from "./components/PortfolioView";
import { QuickTrade } from "./components/QuickTrade";
import { PriceAlerts } from "./components/PriceAlerts";
import { Settings } from "./components/Settings";

const TABS = [
  { id: "portfolio" as const, label: "Portfolio", icon: "chart" },
  { id: "trade" as const, label: "Trade", icon: "swap" },
  { id: "alerts" as const, label: "Alerts", icon: "bell" },
  { id: "settings" as const, label: "Settings", icon: "gear" },
];

const TabIcon = ({ icon, active }: { icon: string; active: boolean }) => {
  const color = active ? "#00d4aa" : "#525c6e";
  switch (icon) {
    case "chart":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      );
    case "swap":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16V4m0 0L3 8m4-4l4 4" />
          <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    case "bell":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case "gear":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
};

export default function App() {
  const { activeTab, setActiveTab, loadPrices, loadSettings } = usePopupStore();

  useEffect(() => {
    loadPrices();
    loadSettings();
  }, [loadPrices, loadSettings]);

  return (
    <div className="flex flex-col h-[500px] w-[380px] bg-novex-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-novex-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-novex-primary-dim flex items-center justify-center">
            <span className="text-novex-primary font-bold text-sm">N</span>
          </div>
          <span className="text-sm font-semibold text-novex-text-primary tracking-tight">
            NovEx
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-novex-success animate-pulse-glow" />
          <span className="text-2xs text-novex-text-muted">Connected</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "portfolio" && <PortfolioView />}
        {activeTab === "trade" && <QuickTrade />}
        {activeTab === "alerts" && <PriceAlerts />}
        {activeTab === "settings" && <Settings />}
      </main>

      {/* Tab Bar */}
      <nav className="flex items-center border-t border-novex-border bg-novex-surface">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-150 ${
              activeTab === tab.id
                ? "text-novex-primary"
                : "text-novex-text-muted hover:text-novex-text-secondary"
            }`}
          >
            <TabIcon icon={tab.icon} active={activeTab === tab.id} />
            <span className="text-2xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
