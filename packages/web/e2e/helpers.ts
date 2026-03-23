import { Page, expect } from '@playwright/test';

/* ─── Seeded accounts ─────────────────────────────────── */

export const ACCOUNTS = {
  alice: { email: 'alice@test.novex.io', password: 'NovEx_Test_2024!' },
  bob:   { email: 'bob@test.novex.io',   password: 'NovEx_Test_2024!' },
} as const;

export type AccountName = keyof typeof ACCOUNTS;

/* ─── Auth helpers ────────────────────────────────────── */

/**
 * Log in as a seeded user via the login page UI.
 * Waits until the trade page loads after redirect.
 */
export async function login(page: Page, account: AccountName): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector('text=Sign in to your account');

  const creds = ACCOUNTS[account];
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to trade page
  await page.waitForURL('**/trade', { timeout: 10_000 });
  // Wait for market data to bootstrap
  await page.waitForSelector('select', { timeout: 10_000 });
}

/**
 * Log out via the navbar profile dropdown.
 */
export async function logout(page: Page): Promise<void> {
  // Open profile dropdown
  const profileBtn = page.locator('header button').filter({ has: page.locator('svg') }).last();
  await profileBtn.click();
  // Click Sign Out
  await page.click('text=Sign Out');
  await page.waitForURL('**/login', { timeout: 5_000 });
}

/* ─── Trading helpers ─────────────────────────────────── */

/**
 * Place a limit order from the trade page.
 * Assumes the user is already logged in and on /trade.
 */
export async function placeOrder(
  page: Page,
  opts: {
    side: 'buy' | 'sell';
    price: string;
    quantity: string;
  },
): Promise<void> {
  // Select side tab
  const sideButton = page.locator(`button:has-text("${opts.side === 'buy' ? 'Buy' : 'Sell'}")`).first();
  await sideButton.click();

  // Ensure limit type is selected
  const limitBtn = page.locator('button:has-text("limit")').first();
  await limitBtn.click();

  // Fill price
  const priceInput = page.locator('input').filter({ has: page.locator('..') }).nth(0);
  const inputs = page.locator('input[type="number"]');

  // Find the price input (first number input in the form)
  const allInputs = await inputs.all();
  if (allInputs.length >= 2) {
    // Price input
    await allInputs[0].fill(opts.price);
    // Amount input
    await allInputs[1].fill(opts.quantity);
  }

  // Click the submit button (contains "Buy BTC" or "Sell BTC")
  const submitText = opts.side === 'buy' ? /Buy\s/ : /Sell\s/;
  await page.locator('button').filter({ hasText: submitText }).click();

  // Wait for order to appear or state to update
  await page.waitForTimeout(1500);
}

/**
 * Cancel the first open order in the orders table.
 * Returns true if a cancel button was found and clicked.
 */
export async function cancelFirstOrder(page: Page): Promise<boolean> {
  // Ensure we're on the Open Orders tab
  await page.click('text=Open Orders');
  await page.waitForTimeout(500);

  const cancelBtn = page.locator('button:has-text("Cancel")').first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

/* ─── Balance helpers ─────────────────────────────────── */

/**
 * Navigate to wallet page and read balance for an asset.
 * Returns the available balance as a string, or null if not found.
 */
export async function getBalance(page: Page, asset: string): Promise<string | null> {
  await page.goto('/wallet');
  await page.waitForSelector('table');
  await page.waitForTimeout(1000);

  // Find the row with this asset
  const row = page.locator('tr').filter({ hasText: asset }).first();
  if (!(await row.isVisible())) return null;

  // The available balance is the second td (after asset name)
  const cells = row.locator('td');
  const availableCell = cells.nth(1);
  const text = await availableCell.textContent();
  return text?.replace(/[,*]/g, '').trim() ?? null;
}

/**
 * Get the count of open orders from the trade page.
 */
export async function getOpenOrderCount(page: Page): Promise<number> {
  const badge = page.locator('button:has-text("Open Orders") span').first();
  if (await badge.isVisible()) {
    const text = await badge.textContent();
    return parseInt(text?.trim() ?? '0', 10);
  }
  return 0;
}

/* ─── Screenshot helper ───────────────────────────────── */

/**
 * Take a labeled screenshot for demo documentation.
 */
export async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: false,
  });
}

/* ─── Wait helpers ────────────────────────────────────── */

/**
 * Wait for a specific text to appear anywhere on the page.
 */
export async function waitForText(page: Page, text: string, timeout = 10_000): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Reload and wait for the page to settle.
 */
export async function refreshAndWait(page: Page, ms = 2000): Promise<void> {
  await page.reload();
  await page.waitForTimeout(ms);
}
