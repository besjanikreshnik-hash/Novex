# NovEx — WebSocket Real-Time Streams

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│  Web Client  │────▶│ Socket.IO Server  │◀────│  EventEmitter2           │
│  (browser)   │◀────│ /ws/market ns     │     │  (NestJS in-process)     │
└─────────────┘     └──────────────────┘     └──────────────────────────┘
                           │                          ▲
                    Rooms:                    Events:
                    {sym}:ticker              trade.executed
                    {sym}:trades              order.placed
                    {sym}:orderbook           order.cancelled
                    user:{userId}             balance.updated
```

## Connection Flow

```
1. Client connects: io("ws://host/ws/market", { auth: { token } })
2. Server handleConnection():
   - If token present: verify JWT → join user:{userId} room → emit 'authenticated'
   - If no token: public-only
3. Client subscribes: emit('subscribe', { symbol: 'BTC_USDT', channels: ['ticker','trades','orderbook'] })
4. Server joins client to rooms: BTC_USDT:ticker, BTC_USDT:trades, BTC_USDT:orderbook
5. Server sends orderbook:snapshot immediately
6. Client receives real-time events from joined rooms
```

## Event Catalog

### Public Events (no auth required)

| Event | Room | Payload | Trigger |
|-------|------|---------|---------|
| `trade` | `{sym}:trades` | `{ symbol, price, quantity, takerSide, seq, timestamp }` | Trade execution |
| `ticker:update` | `{sym}:ticker` | `{ symbol, lastPrice, seq, timestamp }` | Trade execution |
| `orderbook:snapshot` | `{sym}:orderbook` | `{ symbol, bids, asks, seq, timestamp }` | On subscribe |
| `orderbook:update` | `{sym}:orderbook` | `{ symbol, bids, asks, seq, timestamp }` | Trade execution |

### Private Events (auth required)

| Event | Room | Payload | Trigger |
|-------|------|---------|---------|
| `account:order` | `user:{userId}` | `{ type: 'placed'\|'cancelled', order, seq, timestamp }` | Order placed/cancelled |
| `account:fill` | `user:{userId}` | `{ type: 'fill', symbol, price, quantity, role, orderId, seq, timestamp }` | Trade fills user's order |
| `account:balance` | `user:{userId}` | `{ type: 'balance_update', balances[], seq, timestamp }` | Balance change |

### Control Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe` | client→server | `{ symbol, channels[] }` |
| `unsubscribe` | client→server | `{ symbol, channels[] }` |
| `authenticate` | client→server | `{ token }` |
| `subscribed` | server→client | `{ symbol, channels[] }` |
| `authenticated` | server→client | `{ userId }` |
| `auth_error` | server→client | `{ message }` |

## Sequence Numbers

Every event includes a `seq` field — a per-room monotonically increasing counter maintained by the server.

**Client behavior:**
- Track `lastSeq` per room
- Accept event only if `event.seq > lastSeq` for that room
- On duplicate (same or lower seq): silently discard
- On gap (seq jumps): accept anyway (gap = missed event, state will be stale)
- On reconnect: reset seq counters, accept `orderbook:snapshot` to re-sync

**Why this matters:** On reconnect, Socket.IO may replay buffered events from before the disconnect. Without seq tracking, the client would apply stale data on top of fresh data.

## Reconnect & Re-sync Strategy

```
Disconnect detected → state: 'reconnecting'
  ↓
Socket.IO auto-reconnects (exponential backoff, max 15s)
  ↓
Connected → state: 'connected'
  ↓
Client re-subscribes to all active channels (automatic)
  ↓
Server sends orderbook:snapshot (fresh state)
  ↓
Client resets seq counters for that symbol
  ↓
Client fetches HTTP endpoints as fallback sync:
  - GET /orders (accurate order list)
  - GET /wallets/balances (accurate balances)
```

## Client Architecture (Web)

```
ws.ts          — NovExWebSocket class (singleton)
                 Manages socket, reconnect, seq tracking, channel subs

useWebSocket.ts — React hooks
  useWsConnection()   — init connection, return state
  useMarketStream()   — subscribe to public channels for a symbol
  useAccountStream()  — subscribe to private account events

ConnectionStatus.tsx — UI indicator (live/connecting/reconnecting/disconnected)

Trade page:
  1. HTTP bootstrap: fetch pairs, ticker, orderbook, balances, orders
  2. useMarketStream: apply live ticker, orderbook, trade updates
  3. useAccountStream: apply live order/fill/balance updates
  4. On action (place/cancel): HTTP call + WS pushes update

Wallet page:
  1. HTTP bootstrap: fetch balances
  2. useAccountStream: apply live balance updates
  3. Manual refresh button as fallback
```

## Connection State UI

The dashboard layout shows a persistent indicator:

| State | Indicator | Behavior |
|-------|-----------|----------|
| `connected` | Green dot, "Live" | Normal operation |
| `connecting` | Yellow pulsing, "Connecting" | Initial connect |
| `reconnecting` | Yellow pulsing, "Reconnecting" | Auto-reconnect in progress |
| `disconnected` | Red dot, "Disconnected" | All retries exhausted |

When disconnected, a banner appears below the navbar.

## Authentication

1. **On connect**: Token passed in `auth.token` handshake option
2. **After connect**: Client can also send `authenticate` event with a fresh token
3. **Token verification**: Server uses JwtService to verify (same secret as REST API)
4. **On auth success**: Client joins `user:{userId}` room automatically
5. **On token expiry**: Server won't join private room. Client should refresh token and re-authenticate.

## Local Setup

Same as the main demo — the WebSocket server runs on the same port as the REST API:

```bash
# Backend (port 3000)
cd packages/backend && npm run start:dev

# Web (port 3001)
cd packages/web && npm run dev
```

The WebSocket namespace is `/ws/market` on port 3000. The web app connects automatically when the dashboard loads.

## Dedup Test Coverage

```bash
cd packages/web
npx jest src/lib/__tests__/ws-dedup.test.ts
```

10 tests covering:
- First event accepted
- Increasing seq accepted
- Duplicate seq rejected
- Stale seq rejected
- Gap handling (accept jump, reject late fill)
- Independent room tracking
- Prefix-based reset
- Full reset
- Reconnect snapshot scenario
- Private vs public independence
