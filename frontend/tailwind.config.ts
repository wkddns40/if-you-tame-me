import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        serif: ["var(--font-serif)", "Playfair Display", "serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "glow-pulse": "glowPulse 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { transform: "scale(0.1)", filter: "blur(2px)", boxShadow: "0 0 6px 2px rgba(212,166,52,0.3)" },
          "15%": { transform: "scale(1)", filter: "blur(10px)", boxShadow: "0 0 50px 18px rgba(212,166,52,0.95)" },
          "30%": { transform: "scale(0.2)", filter: "blur(3px)", boxShadow: "0 0 10px 4px rgba(212,166,52,0.4)" },
          "45%": { transform: "scale(0.9)", filter: "blur(9px)", boxShadow: "0 0 40px 14px rgba(212,166,52,0.85)" },
          "60%": { transform: "scale(0.1)", filter: "blur(2px)", boxShadow: "0 0 6px 2px rgba(212,166,52,0.3)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
