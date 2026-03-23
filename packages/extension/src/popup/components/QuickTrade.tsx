import { usePopupStore } from "@/stores/popup.store";

const POPULAR_PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
];

export function QuickTrade() {
  const {
    tradeSymbol,
    tradeSide,
    tradeAmount,
    tradeLoading,
    tradeError,
    tradeSuccess,
    setTradeSymbol,
    setTradeSide,
    setTradeAmount,
    submitTrade,
    prices,
  } = usePopupStore();

  const currentPrice = prices[tradeSymbol];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-novex-text-primary">
        Quick Trade
      </h2>

      {/* Pair Selector */}
      <div>
        <label className="text-2xs text-novex-text-muted uppercase tracking-wider block mb-1.5">
          Trading Pair
        </label>
        <select
          value={tradeSymbol}
          onChange={(e) => setTradeSymbol(e.target.value)}
          className="w-full text-sm"
        >
          {POPULAR_PAIRS.map((pair) => (
            <option key={pair} value={pair}>
              {pair.replace("USDT", " / USDT")}
            </option>
          ))}
        </select>
      </div>

      {/* Current Price */}
      {currentPrice !== undefined && (
        <div className="card py-2 px-3 flex items-center justify-between">
          <span className="text-2xs text-novex-text-muted">Current Price</span>
          <span className="text-sm font-mono font-medium text-novex-text-primary">
            $
            {currentPrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </span>
        </div>
      )}

      {/* Side Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-novex-border">
        <button
          onClick={() => setTradeSide("BUY")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 ${
            tradeSide === "BUY"
              ? "bg-novex-primary text-novex-bg"
              : "bg-novex-surface text-novex-text-muted hover:text-novex-text-secondary"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTradeSide("SELL")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 ${
            tradeSide === "SELL"
              ? "bg-novex-danger text-white"
              : "bg-novex-surface text-novex-text-muted hover:text-novex-text-secondary"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-2xs text-novex-text-muted uppercase tracking-wider block mb-1.5">
          Amount
        </label>
        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(e.target.value)}
            className="w-full text-sm font-mono pr-16"
            step="any"
            min="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-novex-text-muted">
            {tradeSymbol.replace("USDT", "")}
          </span>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 mt-2">
          {["25%", "50%", "75%", "100%"].map((pct) => (
            <button
              key={pct}
              onClick={() => {
                /* placeholder: calculate from balance */
              }}
              className="flex-1 text-2xs py-1 rounded bg-novex-surface-light border border-novex-border
                         text-novex-text-muted hover:text-novex-text-secondary hover:border-novex-text-muted
                         transition-colors duration-150"
            >
              {pct}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Total */}
      {tradeAmount && currentPrice && (
        <div className="card py-2 px-3 flex items-center justify-between">
          <span className="text-2xs text-novex-text-muted">Est. Total</span>
          <span className="text-sm font-mono font-medium text-novex-text-primary">
            $
            {(parseFloat(tradeAmount) * currentPrice).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}

      {/* Error / Success */}
      {tradeError && (
        <p className="text-xs text-novex-danger bg-novex-danger-dim rounded-lg px-3 py-2">
          {tradeError}
        </p>
      )}
      {tradeSuccess && (
        <p className="text-xs text-novex-success bg-novex-primary-dim rounded-lg px-3 py-2">
          {tradeSuccess}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={submitTrade}
        disabled={tradeLoading || !tradeAmount}
        className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed ${
            tradeSide === "BUY"
              ? "bg-novex-primary text-novex-bg hover:bg-novex-primary-hover"
              : "bg-novex-danger text-white hover:brightness-110"
          }`}
      >
        {tradeLoading
          ? "Placing Order..."
          : `${tradeSide === "BUY" ? "Buy" : "Sell"} ${tradeSymbol.replace("USDT", "")}`}
      </button>

      <p className="text-2xs text-novex-text-muted text-center">
        Market order on NovEx. Prices may change.
      </p>
    </div>
  );
}
