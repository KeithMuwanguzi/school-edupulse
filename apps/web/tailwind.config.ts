import type { Config } from "tailwindcss";

/**
 * Savanna theme — a warm, credible identity for a Ugandan school portal.
 *
 * - `brand`  : deep teal-pine. Education/growth lineage, but grown-up and calm.
 * - `gold`   : marigold accent (flag + crested crane). Highlights, never body text.
 * - `slate`  : intentionally OVERRIDDEN to a warm stone/ink scale so the whole
 *              existing UI (which uses slate-* everywhere) warms up at once.
 *
 * Density stays ultra-compact; we win through hierarchy, color, and rhythm.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep teal-pine — primary brand.
        brand: {
          50: "#eef6f3",
          100: "#d3e9e2",
          200: "#a9d4c8",
          300: "#74b8a8",
          400: "#3f9885",
          500: "#207d6b",
          600: "#15655a",
          700: "#155049",
          800: "#15413b",
          900: "#123631",
          950: "#0a201d",
        },
        // Marigold gold — accent only (active term, signature highlights).
        gold: {
          50: "#fdf7ea",
          100: "#f9ebc6",
          200: "#f3d68a",
          300: "#ecbd4f",
          400: "#e5a627",
          500: "#cf8a12",
          600: "#b16c0d",
          700: "#8d4f0f",
          800: "#743f13",
          900: "#623514",
        },
        // Warm stone/ink — overrides default cool slate across the app.
        slate: {
          50: "#f9f8f6",
          100: "#f2f1ec",
          200: "#e7e3da",
          300: "#d6d0c4",
          400: "#aaa394",
          500: "#7c766a",
          600: "#5d584d",
          700: "#46423a",
          800: "#2f2c26",
          900: "#1e1c17",
          950: "#12110d",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(30 28 23 / 0.04), 0 1px 3px 0 rgb(30 28 23 / 0.06)",
        // Soft, diffuse shadow for the floating app shell.
        soft: "0 24px 60px -24px rgb(30 28 23 / 0.18), 0 8px 24px -16px rgb(30 28 23 / 0.10)",
        // Quiet lift for interactive tiles on hover.
        lift: "0 12px 28px -16px rgb(21 101 90 / 0.22), 0 2px 6px -3px rgb(30 28 23 / 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
