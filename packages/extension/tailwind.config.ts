import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        novex: {
          bg: "#0b0e14",
          surface: "#131720",
          "surface-light": "#1a1f2e",
          border: "#232a3b",
          primary: "#00d4aa",
          "primary-hover": "#00f0c0",
          "primary-dim": "#00d4aa20",
          secondary: "#7b61ff",
          "secondary-hover": "#9580ff",
          accent: "#ff6b35",
          danger: "#ff4757",
          "danger-dim": "#ff475720",
          warning: "#ffa726",
          success: "#00d4aa",
          "text-primary": "#e8ecf1",
          "text-secondary": "#8a94a6",
          "text-muted": "#525c6e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
