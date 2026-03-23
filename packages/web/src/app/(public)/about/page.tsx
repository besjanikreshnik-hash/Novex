import Link from "next/link";
import { ArrowLeft, Rocket, Users, Code2, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "About - NovEx",
  description: "Learn about the NovEx crypto exchange platform.",
};

const pillars = [
  {
    icon: Rocket,
    title: "Performance First",
    text: "Our in-memory matching engine processes orders in under 40 milliseconds, giving every trader institutional-grade speed.",
  },
  {
    icon: Users,
    title: "Accessible to Everyone",
    text: "Zero trading fees and a clean, intuitive interface mean you can focus on strategy instead of overhead.",
  },
  {
    icon: Code2,
    title: "Open & Transparent",
    text: "NovEx is an educational platform built with modern technologies including Next.js, Node.js, and WebSockets.",
  },
  {
    icon: ShieldCheck,
    title: "Security by Design",
    text: "From hashed credentials to encrypted connections, security is woven into every layer of the stack.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        About <span className="text-novex-primary">NovEx</span>
      </h1>

      <p className="mt-6 text-lg leading-relaxed text-text-secondary">
        NovEx is a demonstration crypto exchange built to showcase modern
        full-stack engineering. It simulates real-time spot trading with a
        WebSocket-powered order book, live candlestick charts, and an
        institutional-style matching engine &mdash; all running with zero real
        funds at stake.
      </p>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {pillars.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-dark-700 bg-dark-800/50 p-6"
          >
            <div className="mb-4 inline-flex rounded-xl bg-novex-primary-light p-3">
              <p.icon className="h-6 w-6 text-novex-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{p.title}</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              {p.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-dark-700 bg-dark-800/50 p-8 text-center">
        <h2 className="text-2xl font-bold">Want to explore?</h2>
        <p className="mt-2 text-text-secondary">
          Jump into the trading terminal and see it in action.
        </p>
        <Link
          href="/trade"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-novex-primary px-8 py-3 text-base font-semibold text-white transition-all hover:bg-novex-primary-hover"
        >
          Open Trading Terminal
        </Link>
      </div>
    </main>
  );
}
