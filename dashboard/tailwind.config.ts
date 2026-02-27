import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        forge: {
          primary: "#6366f1", // Indigo
          secondary: "#8b5cf6", // Purple
          accent: "#06b6d4", // Cyan
          success: "#10b981", // Green
          warning: "#f59e0b", // Amber
          error: "#ef4444", // Red
          dark: "#0f172a", // Slate 900
          light: "#f8fafc", // Slate 50
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
