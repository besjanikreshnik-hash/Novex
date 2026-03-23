import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "API Documentation - NovEx",
  description:
    "Complete REST API reference for the NovEx crypto exchange platform.",
};

/* ------------------------------------------------------------------ */
/*  Types & data                                                       */
/* ------------------------------------------------------------------ */

interface Endpoint {
  method: "GET" | "POST" | "DELETE" | "PATCH";
  path: string;
  description: string;
  body?: string;
  response: string;
}

interface EndpointCategory {
  title: string;
  endpoints: Endpoint[];
}

const methodColor: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
  PATCH: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const categories: EndpointCategory[] = [
  {
    title: "Auth",
    endpoints: [
      {
        method: "POST",
        path: "/auth/register",
        description: "Create a new user account.",
        body: JSON.stringify(
          { email: "user@example.com", password: "SecureP@ss1" },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            email: "user@example.com",
            createdAt: "2025-06-01T12:00:00.000Z",
          },
          null,
          2,
        ),
      },
      {
        method: "POST",
        path: "/auth/login",
        description:
          "Authenticate and receive an access token and refresh token.",
        body: JSON.stringify(
          { email: "user@example.com", password: "SecureP@ss1" },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            accessToken: "eyJhbGciOiJIUzI1NiIs...",
            refreshToken: "dGhpcyBpcyBhIHJlZnJl...",
            expiresIn: 900,
          },
          null,
          2,
        ),
      },
      {
        method: "POST",
        path: "/auth/refresh",
        description: "Exchange a refresh token for a new access token.",
        body: JSON.stringify(
          { refreshToken: "dGhpcyBpcyBhIHJlZnJl..." },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            accessToken: "eyJhbGciOiJIUzI1NiIs...",
            expiresIn: 900,
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    title: "Market Data",
    endpoints: [
      {
        method: "GET",
        path: "/market/pairs",
        description: "List all available trading pairs.",
        response: JSON.stringify(
          {
            pairs: [
              {
                symbol: "BTC_USDT",
                base: "BTC",
                quote: "USDT",
                status: "active",
              },
              {
                symbol: "ETH_USDT",
                base: "ETH",
                quote: "USDT",
                status: "active",
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        method: "GET",
        path: "/market/ticker/:pair",
        description:
          "Get 24-hour ticker statistics for a specific trading pair.",
        response: JSON.stringify(
          {
            pair: "BTC_USDT",
            lastPrice: "67432.50",
            high24h: "68100.00",
            low24h: "66800.00",
            volume24h: "1234.5678",
            change24h: "1.25",
          },
          null,
          2,
        ),
      },
      {
        method: "GET",
        path: "/market/orderbook/:pair",
        description:
          "Retrieve the current order book (bids and asks) for a pair.",
        response: JSON.stringify(
          {
            bids: [
              ["67400.00", "0.5000"],
              ["67390.00", "1.2000"],
            ],
            asks: [
              ["67450.00", "0.3000"],
              ["67460.00", "0.8000"],
            ],
          },
          null,
          2,
        ),
      },
      {
        method: "GET",
        path: "/market/candles/:pair",
        description:
          "Fetch OHLCV candlestick data. Query params: interval (1m, 5m, 1h, 1d), limit.",
        response: JSON.stringify(
          {
            candles: [
              {
                time: 1717200000,
                open: "67000.00",
                high: "67500.00",
                low: "66900.00",
                close: "67432.50",
                volume: "45.123",
              },
            ],
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    title: "Trading",
    endpoints: [
      {
        method: "POST",
        path: "/orders",
        description: "Place a new order (limit or market).",
        body: JSON.stringify(
          {
            pair: "BTC_USDT",
            side: "buy",
            type: "limit",
            price: "67000.00",
            amount: "0.1000",
          },
          null,
          2,
        ),
        response: JSON.stringify(
          {
            id: "ord_abc123",
            pair: "BTC_USDT",
            side: "buy",
            type: "limit",
            price: "67000.00",
            amount: "0.1000",
            filled: "0.0000",
            status: "open",
            createdAt: "2025-06-01T12:05:00.000Z",
          },
          null,
          2,
        ),
      },
      {
        method: "GET",
        path: "/orders",
        description:
          "List your open and recent orders. Query params: pair, status, limit.",
        response: JSON.stringify(
          {
            orders: [
              {
                id: "ord_abc123",
                pair: "BTC_USDT",
                side: "buy",
                type: "limit",
                price: "67000.00",
                amount: "0.1000",
                filled: "0.0000",
                status: "open",
                createdAt: "2025-06-01T12:05:00.000Z",
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        method: "DELETE",
        path: "/orders/:id",
        description: "Cancel an open order by ID.",
        response: JSON.stringify(
          {
            id: "ord_abc123",
            status: "cancelled",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    title: "Wallet",
    endpoints: [
      {
        method: "GET",
        path: "/wallets/balances",
        description: "Get all wallet balances for the authenticated user.",
        response: JSON.stringify(
          {
            balances: [
              {
                asset: "BTC",
                available: "1.23456789",
                locked: "0.10000000",
              },
              {
                asset: "USDT",
                available: "50000.00",
                locked: "6700.00",
              },
            ],
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    title: "Notifications",
    endpoints: [
      {
        method: "GET",
        path: "/notifications",
        description:
          "Retrieve a paginated list of notifications. Query params: page, limit.",
        response: JSON.stringify(
          {
            notifications: [
              {
                id: "ntf_001",
                type: "order_filled",
                message: "Your BTC_USDT buy order was filled",
                read: false,
                createdAt: "2025-06-01T12:10:00.000Z",
              },
            ],
            total: 42,
            page: 1,
          },
          null,
          2,
        ),
      },
      {
        method: "GET",
        path: "/notifications/unread-count",
        description: "Get the number of unread notifications.",
        response: JSON.stringify({ count: 5 }, null, 2),
      },
      {
        method: "PATCH",
        path: "/notifications/:id/read",
        description: "Mark a single notification as read.",
        response: JSON.stringify(
          { id: "ntf_001", read: true },
          null,
          2,
        ),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="mt-3">
      <span className="text-2xs uppercase tracking-wider text-text-tertiary">
        {title}
      </span>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-dark-950 border border-dark-700 p-4 text-xs leading-relaxed font-mono text-text-secondary">
        {children}
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-bold tracking-wide ${methodColor[method] ?? ""}`}
    >
      {method}
    </span>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-5">
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono text-text-primary">{ep.path}</code>
      </div>
      <p className="mt-2 text-sm text-text-secondary">{ep.description}</p>

      {ep.body && <CodeBlock title="Request body">{ep.body}</CodeBlock>}
      <CodeBlock title="Response">{ep.response}</CodeBlock>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      {/* Back link */}
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Title */}
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Nov<span className="text-novex-primary">Ex</span> API Documentation
      </h1>

      {/* Introduction */}
      <p className="mt-6 text-lg leading-relaxed text-text-secondary">
        The NovEx REST API gives you programmatic access to market data,
        trading, wallet balances, and account notifications. All endpoints
        return JSON and use standard HTTP methods. Authenticated endpoints
        require a Bearer token obtained through the login flow.
      </p>

      {/* Base URL */}
      <div className="mt-8 rounded-xl border border-dark-700 bg-dark-800/50 p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Base URL
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-dark-950 border border-dark-700 p-4 text-sm font-mono text-text-secondary">
          https://api.novex.io/v1
        </pre>
      </div>

      {/* Authentication */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-text-primary">
          Authentication
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Most endpoints require authentication via a Bearer token. After
          logging in through <code className="text-novex-primary">POST /auth/login</code>,
          include the returned access token in the <code className="text-novex-primary">Authorization</code> header
          of every subsequent request.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-dark-950 border border-dark-700 p-4 text-sm font-mono text-text-secondary leading-relaxed">
{`Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`}
        </pre>
        <p className="mt-3 text-sm text-text-secondary">
          Access tokens expire after 15 minutes. Use the refresh endpoint to
          obtain a new access token without re-entering credentials.
        </p>
      </section>

      {/* Rate Limiting */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-text-primary">
          Rate Limiting
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          API requests are rate-limited to 60 requests per minute per IP for
          public endpoints and 120 requests per minute per user for
          authenticated endpoints. Exceeding the limit returns a{" "}
          <code className="text-novex-primary">429 Too Many Requests</code>{" "}
          response with a <code className="text-novex-primary">Retry-After</code> header.
        </p>
      </section>

      {/* Endpoints */}
      <section className="mt-16 space-y-14">
        {categories.map((cat) => (
          <div key={cat.title}>
            <h2 className="text-2xl font-bold text-text-primary mb-6">
              {cat.title}
            </h2>
            <div className="space-y-5">
              {cat.endpoints.map((ep) => (
                <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Error Codes */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-text-primary mb-4">
          Error Codes
        </h2>
        <div className="overflow-x-auto rounded-xl border border-dark-700 bg-dark-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 text-text-tertiary">
                <th className="text-left px-5 py-3 font-medium text-xs">
                  Status
                </th>
                <th className="text-left px-5 py-3 font-medium text-xs">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <tr className="border-b border-dark-700/50">
                <td className="px-5 py-3 font-mono">400</td>
                <td className="px-5 py-3">
                  Bad Request - Invalid parameters or missing fields.
                </td>
              </tr>
              <tr className="border-b border-dark-700/50">
                <td className="px-5 py-3 font-mono">401</td>
                <td className="px-5 py-3">
                  Unauthorized - Missing or expired access token.
                </td>
              </tr>
              <tr className="border-b border-dark-700/50">
                <td className="px-5 py-3 font-mono">403</td>
                <td className="px-5 py-3">
                  Forbidden - Insufficient permissions.
                </td>
              </tr>
              <tr className="border-b border-dark-700/50">
                <td className="px-5 py-3 font-mono">404</td>
                <td className="px-5 py-3">
                  Not Found - Resource does not exist.
                </td>
              </tr>
              <tr className="border-b border-dark-700/50">
                <td className="px-5 py-3 font-mono">429</td>
                <td className="px-5 py-3">
                  Too Many Requests - Rate limit exceeded.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-mono">500</td>
                <td className="px-5 py-3">
                  Internal Server Error - Something went wrong on our end.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer CTA */}
      <div className="mt-16 rounded-2xl border border-dark-700 bg-dark-800/50 p-8 text-center">
        <h2 className="text-2xl font-bold">Ready to build?</h2>
        <p className="mt-2 text-text-secondary">
          Create an account and start integrating with the NovEx API today.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-novex-primary px-8 py-3 text-base font-semibold text-white transition-all hover:bg-novex-primary-hover"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
