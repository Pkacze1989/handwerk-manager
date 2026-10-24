import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3f0ea",
        sand: "#fbf9f5",
        ink: "#1c2421",
        muted: "#5c675f",
        line: "#e4ddd2",
        spruce: {
          DEFAULT: "#1e4638",
          deep: "#10281f",
          soft: "#e5efe9",
          mid: "#3e6b58",
        },
        copper: {
          DEFAULT: "#a45b38",
          soft: "#f6ebe4",
        },
        bad: "#8f3d36",
        warn: "#8a5a12",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(28, 36, 33, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
