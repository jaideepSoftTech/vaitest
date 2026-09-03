import type { Config } from "tailwindcss";

// Design tokens — Week 1 deliverable (06-TEAM-FRONTEND.md roadmap row 1:
// "Next.js scaffold, Tailwind, shadcn, design tokens, dark mode"). Colors
// reference CSS custom properties defined in app/globals.css so dark mode is
// a class toggle, not a second token set.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/*/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        amber: {
          strip: "hsl(var(--amber-strip))",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
