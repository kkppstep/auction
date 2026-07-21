import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        asphalt: "#14161A",
        surface: "#1E2127",
        surface2: "#262A32",
        chrome: "#C8CDD4",
        ivory: "#F4F3EF",
        amber: "#FFB020",
        ember: "#FF5A3D",
        steel: "#3E6B8A",
        steel2: "#5A8AAE",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        gauge: "0 0 0 1px rgba(255,176,32,0.25), 0 8px 24px rgba(0,0,0,0.45)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
