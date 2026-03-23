import { useEffect, useState } from "react";
import { usePopupStore } from "@/stores/popup.store";
import { api } from "@/lib/api";

export function Settings() {
  const { settings, settingsLoading, settingsSaved, loadSettings, saveSettings } =
    usePopupStore();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.novex.io");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [priceCheckInterval, setPriceCheckInterval] = useState(1);
  const [currency, setCurrency] = useState<"USD" | "EUR" | "GBP">("USD");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setApiKey(settings.apiKey);
      setApiSecret(settings.apiSecret);
      setBaseUrl(settings.baseUrl);
      setNotificationsEnabled(settings.notificationsEnabled);
      setPriceCheckInterval(settings.priceCheckIntervalMinutes);
      setCurrency(settings.currency);
    }
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      apiKey,
      apiSecret,
      baseUrl,
      notificationsEnabled,
      priceCheckIntervalMinutes: priceCheckInterval,
      currency,
    });
  };

  const handleTestConnection = async () => {
    setTestStatus("loading");
    const result = await api.testConnection();
    setTestStatus(result.success ? "success" : "error");
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  if (settingsLoading && !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-novex-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-novex-text-primary">
        Settings
      </h2>

      {/* API Configuration */}
      <div className="card space-y-3">
        <h3 className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
          API Configuration
        </h3>

        <div>
          <label className="text-2xs text-novex-text-muted block mb-1">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your NovEx API key"
            className="w-full text-sm font-mono"
          />
        </div>

        <div>
          <label className="text-2xs text-novex-text-muted block mb-1">
            API Secret
          </label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder="Enter your NovEx API secret"
            className="w-full text-sm font-mono"
          />
        </div>

        <div>
          <label className="text-2xs text-novex-text-muted block mb-1">
            API Base URL
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full text-sm font-mono"
          />
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testStatus === "loading" || !apiKey}
          className="btn-secondary w-full text-xs"
        >
          {testStatus === "loading"
            ? "Testing..."
            : testStatus === "success"
              ? "Connected!"
              : testStatus === "error"
                ? "Connection Failed"
                : "Test Connection"}
        </button>

        <p className="text-2xs text-novex-text-muted">
          Generate API keys from your{" "}
          <a
            href="https://app.novex.io/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-novex-primary hover:text-novex-primary-hover underline"
          >
            NovEx account settings
          </a>
          .
        </p>
      </div>

      {/* Preferences */}
      <div className="card space-y-3">
        <h3 className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
          Preferences
        </h3>

        <div className="flex items-center justify-between">
          <label className="text-xs text-novex-text-primary">
            Push Notifications
          </label>
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
              notificationsEnabled ? "bg-novex-primary" : "bg-novex-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                notificationsEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-2xs text-novex-text-muted block mb-1">
            Price Check Interval
          </label>
          <select
            value={priceCheckInterval}
            onChange={(e) => setPriceCheckInterval(Number(e.target.value))}
            className="w-full text-sm"
          >
            <option value={1}>Every 1 minute</option>
            <option value={5}>Every 5 minutes</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
        </div>

        <div>
          <label className="text-2xs text-novex-text-muted block mb-1">
            Display Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "EUR" | "GBP")}
            className="w-full text-sm"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (E)</option>
            <option value="GBP">GBP (P)</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <button onClick={handleSave} className="btn-primary w-full">
        {settingsSaved ? "Saved!" : "Save Settings"}
      </button>

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-2xs text-novex-text-muted">
          NovEx Companion v0.1.0
        </p>
        <a
          href="https://novex.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-2xs text-novex-primary hover:text-novex-primary-hover"
        >
          Open NovEx Web App
        </a>
      </div>
    </div>
  );
}
