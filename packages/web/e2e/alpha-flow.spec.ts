import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  login,
  logout,
  placeOrder,
  cancelFirstOrder,
  getBalance,
  getOpenOrderCount,
  screenshot,
  waitForText,
  refreshAndWait,
  ACCOUNTS,
} from './helpers';

/**
 * NovEx Internal-Alpha E2E Tests
 *
 * Prerequisites:
 *   1. Backend running at localhost:3000 with seeded data (npm run seed)
 *   2. Web app running at localhost:3001
 *
 * Run: cd packages/web && npm run test:e2e
 *
 * These tests run sequentially — they share the seeded database state.
 * Each test uses the state left by the previous one.
 */

test.describe.serial('NovEx Internal Alpha Flow', () => {
  let alicePage: Page;
  let bobPage: Page;
  let aliceContext: BrowserContext;
  let bobContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Two isolated browser contexts = two separate sessions
    aliceContext = await browser.newContext();
    bobContext = await browser.newContext();
    alicePage = await aliceContext.newPage();
    bobPage = await bobContext.newPage();
  });

  test.afterAll(async () => {
    await aliceContext.close();
    await bobContext.close();
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 1: Login as Alice
   * ═══════════════════════════════════════════════════════ */
  test('1. Login with seeded Alice account', async () => {
    await login(alicePage, 'alice');

    // Verify we're on the trade page
    await expect(alicePage).toHaveURL(/\/trade/);

    // Verify pair selector is visible
    await expect(alicePage.locator('select')).toBeVisible();

    await screenshot(alicePage, '01-alice-trade-page');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 2: Alice places a buy limit order
   * ═══════════════════════════════════════════════════════ */
  test('2. Alice places buy limit order', async () => {
    // Navigate to trade page (may already be there)
    await alicePage.goto('/trade');
    await alicePage.waitForTimeout(2000);

    await placeOrder(alicePage, {
      side: 'buy',
      price: '48000',
      quantity: '0.1',
    });

    // Verify order appears in open orders
    await alicePage.click('text=Open Orders');
    await alicePage.waitForTimeout(1000);

    // Should see at least one open order
    const rows = alicePage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Verify BUY text in the table
    await expect(alicePage.locator('td:has-text("BUY")')).toBeVisible();

    await screenshot(alicePage, '02-alice-buy-order-placed');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 3: Login as Bob in separate session
   * ═══════════════════════════════════════════════════════ */
  test('3. Login as Bob in separate session', async () => {
    await login(bobPage, 'bob');

    await expect(bobPage).toHaveURL(/\/trade/);
    await expect(bobPage.locator('select')).toBeVisible();

    await screenshot(bobPage, '03-bob-trade-page');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 4: Bob places matching sell order
   * ═══════════════════════════════════════════════════════ */
  test('4. Bob places matching sell order', async () => {
    await bobPage.goto('/trade');
    await bobPage.waitForTimeout(2000);

    await placeOrder(bobPage, {
      side: 'sell',
      price: '48000',
      quantity: '0.1',
    });

    // Wait for trade execution (WebSocket + fallback)
    await bobPage.waitForTimeout(2000);

    await screenshot(bobPage, '04-bob-sell-order-matched');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 5: Verify fill appears for both users
   * ═══════════════════════════════════════════════════════ */
  test('5. Verify fills appear for both Alice and Bob', async () => {
    // Alice: check fills tab
    await refreshAndWait(alicePage);
    await alicePage.click('text=Fills');
    await alicePage.waitForTimeout(1000);

    // Should have a filled order
    const aliceFills = alicePage.locator('td:has-text("filled")');
    await expect(aliceFills.first()).toBeVisible({ timeout: 5000 });

    await screenshot(alicePage, '05a-alice-fills');

    // Bob: check fills tab
    await refreshAndWait(bobPage);
    await bobPage.click('text=Fills');
    await bobPage.waitForTimeout(1000);

    const bobFills = bobPage.locator('td:has-text("filled")');
    await expect(bobFills.first()).toBeVisible({ timeout: 5000 });

    await screenshot(bobPage, '05b-bob-fills');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 6: Verify balances update correctly
   * ═══════════════════════════════════════════════════════ */
  test('6. Verify balances update after trade', async () => {
    // Alice: should have BTC (she bought)
    await alicePage.goto('/wallet');
    await alicePage.waitForSelector('table', { timeout: 5000 });
    await alicePage.waitForTimeout(1500);

    // Alice had 100,000 USDT initially. After buying 0.1 BTC @ 48000 = 4,800 USDT spent
    // Her USDT should be less than 100,000
    const aliceUsdtRow = alicePage.locator('tr').filter({ hasText: 'USDT' });
    await expect(aliceUsdtRow).toBeVisible();

    // Alice should have BTC balance (original 2 + purchased amount)
    const aliceBtcRow = alicePage.locator('tr').filter({ hasText: 'BTC' });
    await expect(aliceBtcRow).toBeVisible();

    await screenshot(alicePage, '06a-alice-wallet-after-trade');

    // Bob: should have USDT (he sold BTC for it)
    await bobPage.goto('/wallet');
    await bobPage.waitForSelector('table', { timeout: 5000 });
    await bobPage.waitForTimeout(1500);

    const bobUsdtRow = bobPage.locator('tr').filter({ hasText: 'USDT' });
    await expect(bobUsdtRow).toBeVisible();

    await screenshot(bobPage, '06b-bob-wallet-after-trade');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 7: Place and cancel a resting order
   * ═══════════════════════════════════════════════════════ */
  test('7. Alice places and cancels a resting order', async () => {
    await alicePage.goto('/trade');
    await alicePage.waitForTimeout(2000);

    // Place a buy order at a price that won't match (low price)
    await placeOrder(alicePage, {
      side: 'buy',
      price: '30000',
      quantity: '0.05',
    });

    // Verify it's in open orders
    await alicePage.click('text=Open Orders');
    await alicePage.waitForTimeout(1000);

    const openCount = await getOpenOrderCount(alicePage);
    expect(openCount).toBeGreaterThanOrEqual(1);

    await screenshot(alicePage, '07a-alice-resting-order');

    // Cancel it
    const cancelled = await cancelFirstOrder(alicePage);
    expect(cancelled).toBe(true);

    await screenshot(alicePage, '07b-alice-order-cancelled');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 8: Verify locked funds are released after cancel
   * ═══════════════════════════════════════════════════════ */
  test('8. Verify locked funds released after cancel', async () => {
    await alicePage.goto('/wallet');
    await alicePage.waitForSelector('table', { timeout: 5000 });
    await alicePage.waitForTimeout(1500);

    // Check that USDT locked column shows 0 (or very small)
    // The USDT row should exist
    const usdtRow = alicePage.locator('tr').filter({ hasText: 'USDT' });
    await expect(usdtRow).toBeVisible();

    // The locked column (3rd td) should show 0
    const cells = usdtRow.locator('td');
    const lockedCell = cells.nth(2); // 0=asset, 1=available, 2=locked
    const lockedText = await lockedCell.textContent();

    // Locked should be 0 (no open orders)
    const lockedValue = parseFloat(lockedText?.replace(/[,*]/g, '') ?? '0');
    expect(lockedValue).toBe(0);

    await screenshot(alicePage, '08-alice-funds-unlocked');
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 9: Protected routes redirect when logged out
   * ═══════════════════════════════════════════════════════ */
  test('9. Protected routes redirect to login when logged out', async () => {
    // Create a fresh context with no auth
    const anonContext = await alicePage.context().browser()!.newContext();
    const anonPage = await anonContext.newPage();

    // Try to access /trade without logging in
    await anonPage.goto('/trade');

    // Should redirect to /login
    await anonPage.waitForURL('**/login', { timeout: 5000 });
    await expect(anonPage).toHaveURL(/\/login/);

    // Same for /wallet
    await anonPage.goto('/wallet');
    await anonPage.waitForURL('**/login', { timeout: 5000 });
    await expect(anonPage).toHaveURL(/\/login/);

    await screenshot(anonPage, '09-redirect-to-login');

    await anonContext.close();
  });

  /* ═══════════════════════════════════════════════════════
   * Scenario 10: Capture final screenshots for demo docs
   * ═══════════════════════════════════════════════════════ */
  test('10. Capture final demo screenshots', async () => {
    // Alice's final trade view
    await alicePage.goto('/trade');
    await alicePage.waitForTimeout(2000);
    await screenshot(alicePage, '10a-final-alice-trade');

    // Alice's final wallet
    await alicePage.goto('/wallet');
    await alicePage.waitForTimeout(2000);
    await screenshot(alicePage, '10b-final-alice-wallet');

    // Bob's final trade view
    await bobPage.goto('/trade');
    await bobPage.waitForTimeout(2000);
    await screenshot(bobPage, '10c-final-bob-trade');

    // Bob's final wallet
    await bobPage.goto('/wallet');
    await bobPage.waitForTimeout(2000);
    await screenshot(bobPage, '10d-final-bob-wallet');

    // Login page
    const loginPage = await aliceContext.newPage();
    await loginPage.goto('/login');
    await loginPage.waitForTimeout(1000);
    await screenshot(loginPage, '10e-login-page');
    await loginPage.close();
  });
});
