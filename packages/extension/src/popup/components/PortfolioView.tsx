import { useEffect } from "react";
import { usePopupStore } from "@/stores/popup.store";
import Decimal from "decimal.js";

const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  USDT: "#26a17b",
  USDC: "#2775ca",
  BNB: "#f3ba2f",
  XRP: "#00aae4",
  ADA: "#0033ad",
  DOGE: "#c2a633",
  AVAX: "#e84142",
};

function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatCrypto(value: string): string {
  const d = new Decimal(value);
  if (d.gte(1000)) return d.toFixed(2);
  if (d.gte(1)) return d.toFixed(4);
  return d.toFixed(6);
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function PortfolioView() {
  const { portfolio, portfolioLoading, portfolioError, loadPortfolio } =
    usePopupStore();

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  if (portfolioLoading && !portfolio) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-novex-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-novex-text-muted">
            Loading portfolio...
          </span>
        </div>
      </div>
    );
  }

  if (portfolioError && !portfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <div className="w-10 h-10 rounded-full bg-novex-danger-dim flex items-center justify-center">
          <span className="text-novex-danger text-lg">!</span>
        </div>
        <p className="text-xs text-novex-text-secondary text-center">
          {portfolioError}
        </p>
        <button onClick={loadPortfolio} className="btn-secondary text-xs">
          Retry
        </button>
      </div>
    );
  }

  const holdings = (portfolio?.balances ?? [])
    .filter((b) => new Decimal(b.usdValue).gt(0.01))
    .sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue));

  return (
    <div className="p-4 space-y-4">
      {/* Total Value Card */}
      <div className="card text-center">
        <p className="text-2xs text-novex-text-muted uppercase tracking-wider mb-1">
          Total Portfolio Value
        </p>
        <p className="text-2xl font-bold text-novex-text-primary">
          {portfolio ? formatUsd(portfolio.totalUsdValue) : "$0.00"}
        </p>
        {portfolio && (
          <p className="text-2xs text-novex-text-muted mt-1">
            Updated {timeAgo(portfolio.lastUpdated)}
            {portfolioLoading && " - refreshing..."}
          </p>
        )}
      </div>

      {/* Holdings */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
            Holdings
          </h3>
          <button
            onClick={loadPortfolio}
            disabled={portfolioLoading}
            className="text-2xs text-novex-primary hover:text-novex-primary-hover transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {holdings.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-xs text-novex-text-muted">
              No holdings found. Make sure your API key is configured.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {holdings.map((holding) => (
              <div
                key={holding.asset}
                className="card flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      backgroundColor:
                        ASSET_COLORS[holding.asset] ?? "#525c6e",
                    }}
                  >
                    {holding.asset.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-novex-text-primary">
                      {holding.asset}
                    </p>
                    <p className="text-2xs text-novex-text-muted font-mono">
                      {formatCrypto(holding.free)}
                      {new Decimal(holding.locked).gt(0) && (
                        <span className="text-novex-warning ml-1">
                          +{formatCrypto(holding.locked)} locked
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium text-novex-text-primary font-mono">
                  {formatUsd(holding.usdValue)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
