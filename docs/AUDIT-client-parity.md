# NovEx — Client Platform Parity Audit

## Executive Summary

The web client is the only platform wired end-to-end to the real backend. The mobile and extension clients remain in scaffold/mock state. This audit identifies every gap by domain and produces a prioritized list of blockers for controlled pilot across platforms.

**Pilot readiness:**
- **Web:** Ready (with known findings from security audit)
- **Mobile:** Not ready — requires full API wiring
- **Extension:** Not ready — requires API alignment and auth model change

---

## 1. Authentication & Session Handling

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| Login (email/password) | Real API | Real API | N/A (uses API keys) |
| Registration | Real API | Real API | N/A |
| Token storage | localStorage | expo-secure-store | chrome.storage.sync |
| Token type | JWT (access + refresh) | JWT (access + refresh) | API key + secret |
| 401 auto-redirect | Yes (→ /login) | Yes (→ logout) | No (generic error) |
| Token refresh | **No** | **No** | N/A |
| Biometric auth | N/A | Yes (expo-local-authentication) | N/A |
| Logout | Real API + clear state | Clear secure store | Clear settings |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-AUTH-1** | No token refresh on any platform — 15-min session death | High | Web, Mobile |
| **P-AUTH-2** | Extension uses API key auth (`X-NovEx-Key`) but backend expects JWT Bearer | Critical | Extension |
| **P-AUTH-3** | Extension has no HMAC signing despite backend supporting it | High | Extension |

---

## 2. Trading Permissions & KYC Gates

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| KYC status in user type | Yes | Yes | No |
| Client-side KYC gate before order | **No** | **No** | **No** |
| Backend KYC enforcement | Yes (KycTierGuard) | Yes (same API) | Yes (same API) |
| Order form (limit) | Real API | **Mock** (not wired) | N/A (market only) |
| Order form (market) | Real API | **Mock** (not wired) | Real API call |
| Market order guardrails (slippage, liquidity) | Yes (book estimation) | **No** | **No** |
| Order cancellation | Real API | **Not implemented** | **Not implemented** |
| Open orders display | Real API (polled + WS) | **Mock data** | **Not implemented** |
| Trade history | Real API | **Mock data** | **Not implemented** |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-TRADE-1** | Mobile order form not wired to API (onSubmit is a no-op) | Critical | Mobile |
| **P-TRADE-2** | Extension sends to `POST /v1/order` but backend expects `POST /api/v1/orders` | Critical | Extension |
| **P-TRADE-3** | No client-side KYC gate on any platform (backend enforces, but no user-friendly error) | Medium | All |
| **P-TRADE-4** | No market order guardrails on mobile or extension (no slippage warning) | Medium | Mobile, Extension |
| **P-TRADE-5** | Extension only supports market orders, no limit orders | Low | Extension |

---

## 3. Funding Restrictions & UX

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| View balances | Real API | **Mock data** | Real API (cached) |
| Deposit address generation | **Not in UI** | **Not in UI** | **Not in UI** |
| Deposit flow | **Not in UI** | **Not in UI** | **Not in UI** |
| Withdrawal request | **Not in UI** | **Not in UI** | **Not in UI** |
| 2FA on withdrawal | **Not implemented** | **Not implemented** | N/A |
| Withdrawal status tracking | **Not in UI** | **Not in UI** | **Not in UI** |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-FUND-1** | No deposit/withdrawal UI on any platform | High | All |
| **P-FUND-2** | Mobile wallet shows mock data, not real balances | High | Mobile |
| **P-FUND-3** | No 2FA enforcement on withdrawals anywhere | Medium | All |

---

## 4. Idempotency & Retry Behavior

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| Idempotency key generation | Yes (crypto.randomUUID) | **No** | **No** |
| X-Idempotency-Key header on orders | Yes | **No** | **No** |
| X-Idempotency-Key header on cancels | Yes | **No** | **No** |
| Double-click prevention | Yes (useIdempotentSubmit) | **No** | **No** |
| Submit state machine (idle→pending→confirmed→failed) | Yes | **No** | **No** |
| Retry with same key on failure | Yes | **No** | **No** |
| Idempotency unit tests | Yes (10 tests) | **No** | **No** |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-IDEM-1** | No idempotency keys on mobile or extension | High | Mobile, Extension |
| **P-IDEM-2** | No double-submit prevention on mobile or extension | High | Mobile, Extension |
| **P-IDEM-3** | No retry state machine on mobile or extension | Medium | Mobile, Extension |

---

## 5. WebSocket / Account Update Behavior

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| Real-time connection | Socket.IO (real) | Socket.IO (real) | **None** (polling) |
| JWT authentication on WS | Yes (handshake + authenticate) | Yes (handshake) | N/A |
| Connection state indicator | Yes (live/connecting/reconnecting/disconnected) | **No** | N/A |
| Public channels (ticker, orderbook, trades) | Yes (useMarketStream) | Yes (but limited) | N/A |
| Private channels (orders, fills, balances) | Yes (useAccountStream) | **No** | N/A |
| Sequence deduplication | Yes (shouldApply with per-room seq) | **No** | N/A |
| Reconnect with re-subscribe | Yes (automatic) | Yes (automatic) | N/A |
| Price alert evaluation | **Not implemented** | **Not implemented** | Yes (background polling) |
| Polling fallback | HTTP fetch on mount + after actions | **No** | Primary mechanism |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-WS-1** | Mobile has no private account stream (no live order/balance updates) | High | Mobile |
| **P-WS-2** | Mobile has no sequence deduplication (stale events may apply) | Medium | Mobile |
| **P-WS-3** | Mobile has no connection state UI indicator | Low | Mobile |
| **P-WS-4** | Extension has no real-time updates (polling only, 1-60min interval) | Low | Extension |

---

## 6. Error Handling & 429/403 Display

| Capability | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| RateLimitError (429) class | Yes | **No** | **No** |
| 429 user-friendly message | Yes (message only, no countdown) | **No** | **No** |
| 403 specific handling | **No** (generic error) | **No** | **No** |
| Error display mechanism | Inline banners + form state | Alert.alert() modals | Inline error cards |
| Loading/pending states | Yes (Submitting... button) | Yes (ActivityIndicator) | Yes (Loading...) |
| Confirmed/failed feedback | Yes (green/red banners) | Haptic feedback | Inline status |

### Gaps

| ID | Gap | Severity | Platforms |
|---|---|---|---|
| **P-ERR-1** | No 429 handling on mobile or extension (shows generic error) | Medium | Mobile, Extension |
| **P-ERR-2** | No 403 handling on any platform (KYC/permission errors shown as generic) | Medium | All |
| **P-ERR-3** | No retry-after countdown UI on any platform | Low | All |

---

## 7. Data: Mock vs Real

| Data Source | Web | Mobile | Extension |
|---|:---:|:---:|:---:|
| Market pairs | Real API | Real API (intended) | Real API |
| Ticker prices | Real API + WS | WS (partial) | Real API (polled) |
| Order book | Real API + WS | **Mock generated** | **Not shown** |
| User balances | Real API + WS | **Mock (7 hardcoded assets)** | Real API (cached) |
| Open orders | Real API + WS | **Mock data** | **Not shown** |
| Trade history | Real API | **Mock data** | **Not shown** |
| Recent trades | WS stream | **Not shown** | **Not shown** |

---

## Pilot Blockers — Prioritized

### Critical (blocks pilot on that platform)

| # | Finding | Platform | Effort |
|---|---------|----------|--------|
| 1 | P-TRADE-1: Mobile order form not wired to API | Mobile | 4h |
| 2 | P-AUTH-2: Extension uses wrong auth model (API key vs JWT) | Extension | 8h |
| 3 | P-TRADE-2: Extension sends to wrong endpoint path | Extension | 1h |
| 4 | P-FUND-2: Mobile wallet shows mock data | Mobile | 2h |

### High (significant UX or safety gap)

| # | Finding | Platform | Effort |
|---|---------|----------|--------|
| 5 | P-AUTH-1: No token refresh (15-min session death) | Web, Mobile | 8h |
| 6 | P-IDEM-1: No idempotency keys on mobile/extension | Mobile, Extension | 4h each |
| 7 | P-IDEM-2: No double-submit prevention | Mobile, Extension | 4h each |
| 8 | P-WS-1: Mobile has no private account stream | Mobile | 4h |
| 9 | P-FUND-1: No deposit/withdrawal UI on any platform | All | 16h per platform |
| 10 | P-AUTH-3: Extension has no HMAC signing | Extension | 4h |

### Medium (should fix for good UX)

| # | Finding | Platform | Effort |
|---|---------|----------|--------|
| 11 | P-TRADE-3: No client-side KYC gate (user-friendly error) | All | 4h |
| 12 | P-TRADE-4: No market order guardrails on mobile/extension | Mobile, Extension | 4h each |
| 13 | P-WS-2: Mobile has no WS sequence dedup | Mobile | 2h |
| 14 | P-ERR-1: No 429 handling on mobile/extension | Mobile, Extension | 2h each |
| 15 | P-ERR-2: No 403 handling on any platform | All | 2h |

---

## Recommendation

### For controlled pilot (web-only):

The web client is ready for a web-only controlled pilot. The critical gaps are all on mobile and extension. Web has real API wiring, idempotency, WebSocket, and error handling.

**Web-specific fixes needed before pilot:**
1. Add token refresh (P-AUTH-1) — prevents session death mid-trade
2. Add 403 handling with user-friendly KYC/permission messages (P-ERR-2)

### For multi-platform pilot:

1. **Phase 1 (web):** Launch web-only pilot immediately
2. **Phase 2 (mobile):** Wire mobile to real API (4 critical items, ~14h)
3. **Phase 3 (extension):** Fix auth model and endpoint paths (~13h)
4. **Phase 4 (all):** Add deposit/withdrawal UI across platforms
