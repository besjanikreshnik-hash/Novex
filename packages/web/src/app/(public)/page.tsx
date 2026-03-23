import Link from "next/link";
import {
  BarChart3,
  Zap,
  Shield,
  Layers,
  SlidersHorizontal,
  Smartphone,
  ArrowRight,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

const stats = [
  { label: "Markets", value: "3" },
  { label: "Trading Fees*", value: "$0" },
  { label: "Execution", value: "<40ms" },
  { label: "Support", value: "24/7" },
];

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Charts",
    description:
      "Professional TradingView-powered charts with multiple timeframes, indicators, and drawing tools.",
  },
  {
    icon: Zap,
    title: "Instant Execution",
    description:
      "Sub-40ms order execution powered by an in-memory matching engine. No slippage, no requotes.",
  },
  {
    icon: Shield,
    title: "Bank-Grade Security",
    description:
      "Enterprise-level encryption, 2FA authentication, and cold storage for digital assets.",
  },
  {
    icon: Layers,
    title: "Multi-Asset Support",
    description:
      "Trade Bitcoin, Ethereum, Solana, and more against USDT with deep liquidity pools.",
  },
  {
    icon: SlidersHorizontal,
    title: "Stop-Limit Orders",
    description:
      "Advanced order types including limit, market, stop-limit, and OCO for precise risk management.",
  },
  {
    icon: Smartphone,
    title: "Mobile Ready",
    description:
      "Fully responsive trading interface. Monitor positions and execute trades from any device.",
  },
];

const markets = [
  {
    pair: "BTC/USDT",
    price: "67,234.50",
    change: "+2.34%",
    volume: "1.2B",
    positive: true,
  },
  {
    pair: "ETH/USDT",
    price: "3,456.78",
    change: "+1.87%",
    volume: "680M",
    positive: true,
  },
  {
    pair: "SOL/USDT",
    price: "178.92",
    change: "-0.54%",
    volume: "320M",
    positive: false,
  },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6">
        {/* Animated gradient background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-1/2 -left-1/4 h-[800px] w-[800px] rounded-full bg-novex-primary/20 blur-[160px] animate-pulse" />
          <div className="absolute -bottom-1/3 -right-1/4 h-[600px] w-[600px] rounded-full bg-novex-success/10 blur-[140px] animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/4 right-1/3 h-[400px] w-[400px] rounded-full bg-novex-primary/10 blur-[120px] animate-pulse [animation-delay:2s]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-dark-600 bg-dark-800/60 px-4 py-1.5 text-sm text-text-secondary backdrop-blur-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-novex-success animate-pulse" />
            Live Trading &mdash; Markets Open
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Trade Crypto with{" "}
            <span className="bg-gradient-to-r from-novex-primary to-novex-success bg-clip-text text-transparent">
              Confidence
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary sm:text-xl">
            Zero trading fees, sub-40&thinsp;ms execution, and institutional-grade
            tools &mdash; everything you need to trade digital assets like a pro.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-novex-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-novex-primary/25 transition-all hover:bg-novex-primary-hover hover:shadow-novex-primary/40"
            >
              Start Trading
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/trade"
              className="inline-flex items-center gap-2 rounded-xl border border-dark-600 bg-dark-800/60 px-8 py-3.5 text-base font-semibold text-text-primary backdrop-blur-sm transition-all hover:border-novex-primary/50 hover:bg-dark-700/60"
            >
              View Markets
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-dark-700 bg-dark-900/80 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-dark-700 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 py-8">
              <span className="text-2xl font-bold text-novex-success sm:text-3xl">
                {s.value}
              </span>
              <span className="text-sm text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Built for{" "}
            <span className="text-novex-primary">Serious Traders</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
            Every feature designed to give you an edge in the markets.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-dark-700 bg-dark-800/50 p-6 transition-all hover:border-novex-primary/40 hover:bg-dark-700/50"
            >
              <div className="mb-4 inline-flex rounded-xl bg-novex-primary-light p-3">
                <f.icon className="h-6 w-6 text-novex-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Markets Preview ──────────────────────────────────── */}
      <section className="border-y border-dark-700 bg-dark-900/60 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">
                Popular Markets
              </h2>
              <p className="mt-2 text-text-secondary">
                Start trading the top digital assets today.
              </p>
            </div>
            <Link
              href="/trade"
              className="hidden items-center gap-1 text-sm font-medium text-novex-primary hover:underline sm:inline-flex"
            >
              View all markets <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {markets.map((m) => (
              <Link
                key={m.pair}
                href="/trade"
                className="group flex items-center justify-between rounded-2xl border border-dark-700 bg-dark-800/50 p-6 transition-all hover:border-novex-primary/40 hover:bg-dark-700/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-novex-primary-light">
                    <TrendingUp className="h-5 w-5 text-novex-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{m.pair}</p>
                    <p className="text-sm text-text-secondary">
                      Vol {m.volume}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold">${m.price}</p>
                  <p
                    className={`text-sm font-medium ${
                      m.positive ? "text-novex-success" : "text-novex-danger"
                    }`}
                  >
                    {m.change}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link
              href="/trade"
              className="inline-flex items-center gap-1 text-sm font-medium text-novex-primary hover:underline"
            >
              View all markets <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────── */}
      <section className="relative py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-novex-primary/15 blur-[140px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to Start Trading?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            Create your free account in seconds and access professional trading
            tools with zero fees.
          </p>
          <Link
            href="/register"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-novex-primary px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-novex-primary/25 transition-all hover:bg-novex-primary-hover hover:shadow-novex-primary/40"
          >
            Create Free Account
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-dark-700 bg-dark-900/80">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            {/* Logo & tagline */}
            <div className="max-w-xs">
              <span className="text-xl font-bold tracking-tight">
                Nov<span className="text-novex-primary">Ex</span>
              </span>
              <p className="mt-2 text-sm text-text-secondary">
                Professional-grade crypto trading for everyone.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <Link
                href="/trade"
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Trade
              </Link>
              <Link
                href="/wallet"
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Wallet
              </Link>
              <Link
                href="/about"
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                About
              </Link>
              <Link
                href="#"
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Support
              </Link>
              <Link
                href="#"
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                API Docs
              </Link>
            </div>
          </div>

          <div className="mt-10 border-t border-dark-700 pt-6">
            <p className="text-xs leading-relaxed text-text-tertiary">
              NovEx is a demo platform for educational purposes only. No real
              funds are involved and no financial advice is provided. Trade
              responsibly.
            </p>
            <p className="mt-2 text-xs text-text-muted">
              &copy; {new Date().getFullYear()} NovEx. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
