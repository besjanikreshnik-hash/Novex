/**
 * NovEx Background Service Worker
 *
 * Responsibilities:
 * - Periodically check prices using the alarms API
 * - Evaluate price alerts and trigger notifications
 * - Manage auth/connection state
 */

import { storage, type PriceAlert, type NovExSettings } from "../lib/storage";

const ALARM_NAME = "novex-price-check";

// ---- Alarm Setup ----

async function setupAlarm(): Promise<void> {
  const settings = await storage.getSettings();
  const interval = settings.priceCheckIntervalMinutes;

  // Clear existing alarm and create new one
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: Math.max(1, interval),
  });

  console.log(`[NovEx] Price check alarm set: every ${interval} minute(s)`);
}

// ---- Price Fetching ----

async function fetchPrices(
  settings: NovExSettings
): Promise<Record<string, number>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.apiKey) {
    headers["X-NovEx-Key"] = settings.apiKey;
  }

  try {
    const response = await fetch(`${settings.baseUrl}/v1/market/tickers`, {
      headers,
    });

    if (!response.ok) {
      console.error(`[NovEx] Price fetch failed: HTTP ${response.status}`);
      return {};
    }

    const tickers = (await response.json()) as Array<{
      symbol: string;
      price: string;
    }>;
    const prices: Record<string, number> = {};
    for (const t of tickers) {
      prices[t.symbol] = parseFloat(t.price);
    }

    // Cache prices
    await storage.setPriceCache(prices);
    return prices;
  } catch (err) {
    console.error("[NovEx] Price fetch error:", err);
    return {};
  }
}

// ---- Alert Evaluation ----

async function evaluateAlerts(
  prices: Record<string, number>
): Promise<void> {
  const alerts = await storage.getAlerts();
  const settings = await storage.getSettings();
  let updated = false;

  for (const alert of alerts) {
    if (alert.triggered) continue;

    const currentPrice = prices[alert.symbol];
    if (currentPrice === undefined) continue;

    const shouldTrigger =
      (alert.direction === "above" && currentPrice >= alert.targetPrice) ||
      (alert.direction === "below" && currentPrice <= alert.targetPrice);

    if (shouldTrigger) {
      alert.triggered = true;
      updated = true;

      if (settings.notificationsEnabled) {
        await showNotification(alert, currentPrice);
      }
    }
  }

  if (updated) {
    await storage.saveAlerts(alerts);
  }
}

// ---- Notifications ----

async function showNotification(
  alert: PriceAlert,
  currentPrice: number
): Promise<void> {
  const symbol = alert.symbol.replace("USDT", "");
  const direction = alert.direction === "above" ? "rose above" : "dropped below";
  const formattedTarget = alert.targetPrice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  const formattedCurrent = currentPrice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  try {
    await chrome.notifications.create(`novex-alert-${alert.id}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: `NovEx: ${symbol} Price Alert`,
      message: `${symbol} has ${direction} ${formattedTarget}. Current price: ${formattedCurrent}`,
      priority: 2,
    });
  } catch (err) {
    console.error("[NovEx] Notification error:", err);
  }
}

// ---- Price Check Handler ----

async function runPriceCheck(): Promise<void> {
  console.log("[NovEx] Running price check...");
  const settings = await storage.getSettings();

  if (!settings.apiKey) {
    console.log("[NovEx] No API key configured, skipping price check");
    return;
  }

  const prices = await fetchPrices(settings);
  if (Object.keys(prices).length > 0) {
    await evaluateAlerts(prices);
  }
}

// ---- Event Listeners ----

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runPriceCheck();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[NovEx] Extension installed/updated");
  await setupAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[NovEx] Browser startup");
  await setupAlarm();
});

// Listen for settings changes to update alarm interval
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    const oldInterval =
      (changes.settings.oldValue as NovExSettings | undefined)
        ?.priceCheckIntervalMinutes ?? 1;
    const newInterval =
      (changes.settings.newValue as NovExSettings | undefined)
        ?.priceCheckIntervalMinutes ?? 1;

    if (oldInterval !== newInterval) {
      console.log(`[NovEx] Alarm interval changed: ${oldInterval} -> ${newInterval}`);
      setupAlarm();
    }
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("novex-alert-")) {
    // Open the NovEx web app
    chrome.tabs.create({ url: "https://app.novex.io" });
    chrome.notifications.clear(notificationId);
  }
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FORCE_PRICE_CHECK") {
    runPriceCheck().then(() => sendResponse({ success: true }));
    return true; // async response
  }

  if (message.type === "GET_STATUS") {
    storage.getSettings().then((settings) => {
      sendResponse({
        connected: !!settings.apiKey,
        alarmInterval: settings.priceCheckIntervalMinutes,
      });
    });
    return true;
  }
});

console.log("[NovEx] Service worker loaded");
