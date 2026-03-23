import { useEffect, useState } from "react";
import { usePopupStore } from "@/stores/popup.store";

const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
];

export function PriceAlerts() {
  const { alerts, alertsLoading, loadAlerts, addAlert, removeAlert, prices } =
    usePopupStore();

  const [showForm, setShowForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState("BTCUSDT");
  const [newPrice, setNewPrice] = useState("");
  const [newDirection, setNewDirection] = useState<"above" | "below">("above");

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAdd = async () => {
    const price = parseFloat(newPrice);
    if (!price || price <= 0) return;
    await addAlert(newSymbol, price, newDirection);
    setNewPrice("");
    setShowForm(false);
  };

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-novex-text-primary">
          Price Alerts
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-2xs text-novex-primary hover:text-novex-primary-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Alert"}
        </button>
      </div>

      {/* Add Alert Form */}
      {showForm && (
        <div className="card space-y-3">
          <div>
            <label className="text-2xs text-novex-text-muted uppercase tracking-wider block mb-1">
              Asset
            </label>
            <select
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="w-full text-sm"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("USDT", " / USDT")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-2xs text-novex-text-muted uppercase tracking-wider block mb-1">
                Price (USD)
              </label>
              <input
                type="number"
                placeholder={
                  prices[newSymbol]
                    ? `Current: $${prices[newSymbol].toLocaleString()}`
                    : "0.00"
                }
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full text-sm font-mono"
                step="any"
                min="0"
              />
            </div>
            <div>
              <label className="text-2xs text-novex-text-muted uppercase tracking-wider block mb-1">
                Direction
              </label>
              <select
                value={newDirection}
                onChange={(e) =>
                  setNewDirection(e.target.value as "above" | "below")
                }
                className="text-sm"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!newPrice || parseFloat(newPrice) <= 0}
            className="btn-primary w-full"
          >
            Create Alert
          </button>
        </div>
      )}

      {/* Active Alerts */}
      {alertsLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-novex-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
        <div className="card text-center py-8">
          <div className="w-10 h-10 rounded-full bg-novex-surface-light flex items-center justify-center mx-auto mb-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#525c6e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <p className="text-xs text-novex-text-muted">
            No alerts set. Create one to get notified when prices hit your
            targets.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="card flex items-center justify-between py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-novex-text-primary">
                    {alert.symbol.replace("USDT", "")}
                  </span>
                  <span
                    className={`badge ${
                      alert.direction === "above"
                        ? "bg-novex-primary-dim text-novex-primary"
                        : "bg-novex-danger-dim text-novex-danger"
                    }`}
                  >
                    {alert.direction === "above" ? "Above" : "Below"}
                  </span>
                </div>
                <p className="text-xs text-novex-text-muted font-mono mt-0.5">
                  $
                  {alert.targetPrice.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                  {prices[alert.symbol] && (
                    <span className="ml-2 text-novex-text-muted">
                      (now: $
                      {prices[alert.symbol].toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="p-1.5 rounded-lg hover:bg-novex-danger-dim transition-colors group"
                title="Remove alert"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#525c6e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:stroke-novex-danger transition-colors"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Triggered alerts section */}
          {triggeredAlerts.length > 0 && (
            <>
              <div className="pt-2">
                <h3 className="text-2xs text-novex-text-muted uppercase tracking-wider mb-1.5">
                  Triggered
                </h3>
              </div>
              {triggeredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="card flex items-center justify-between py-3 opacity-50"
                >
                  <div>
                    <span className="text-sm text-novex-text-secondary">
                      {alert.symbol.replace("USDT", "")}
                    </span>
                    <p className="text-xs text-novex-text-muted font-mono mt-0.5">
                      {alert.direction === "above" ? "Above" : "Below"} $
                      {alert.targetPrice.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-novex-surface-light transition-colors"
                    title="Dismiss"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#525c6e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
