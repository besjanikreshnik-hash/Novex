import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        novex: {
          primary: "#6C5CE7",
          "primary-hover": "#5A4BD6",
          "primary-light": "rgba(108, 92, 231, 0.15)",
          success: "#00D68F",
          "success-hover": "#00B87A",
          "success-light": "rgba(0, 214, 143, 0.15)",
          danger: "#FF3D71",
          "danger-hover": "#E63560",
          "danger-light": "rgba(255, 61, 113, 0.15)",
          warning: "#FFAA00",
          "warning-light": "rgba(255, 170, 0, 0.15)",
          info: "#0095FF",
        },
        // nvx-* aliases — theme-aware via CSS variables
        "nvx-primary": "#6C5CE7",
        "nvx-buy": "#00D68F",
        "nvx-sell": "#FF3D71",
        "nvx-warning": "#FFAA00",
        "nvx-bg-primary": "var(--nvx-bg-primary)",
        "nvx-bg-secondary": "var(--nvx-bg-secondary)",
        "nvx-bg-tertiary": "var(--nvx-bg-tertiary)",
        "nvx-text-primary": "var(--nvx-text-primary)",
        "nvx-text-secondary": "var(--nvx-text-secondary)",
        "nvx-text-muted": "var(--nvx-text-muted)",
        "nvx-border": "var(--nvx-border)",
        dark: {
          950: "var(--nvx-dark-950)",
          900: "var(--nvx-dark-900)",
          800: "var(--nvx-dark-800)",
          700: "var(--nvx-dark-700)",
          600: "var(--nvx-dark-600)",
          500: "var(--nvx-dark-500)",
          400: "var(--nvx-dark-400)",
        },
        text: {
          primary: "var(--nvx-text-primary)",
          secondary: "var(--nvx-text-secondary)",
          tertiary: "var(--nvx-text-tertiary)",
          muted: "var(--nvx-text-muted)",
        },
        border: {
          DEFAULT: "var(--nvx-border)",
          light: "var(--nvx-border-light)",
          focus: "#6C5CE7",
        },
        buy: "#00D68F",
        sell: "#FF3D71",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains)",
          "JetBrains Mono",
          "Fira Code",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-green": "pulseGreen 0.6s ease-out",
        "pulse-red": "pulseRed 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGreen: {
          "0%": { backgroundColor: "rgba(0, 214, 143, 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        pulseRed: {
          "0%": { backgroundColor: "rgba(255, 61, 113, 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
