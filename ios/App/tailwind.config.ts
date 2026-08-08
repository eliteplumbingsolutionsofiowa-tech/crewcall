import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F5F9FF",
          100: "#EAF2FF",
          200: "#D6E7FF",
          300: "#AFCFFF",
          400: "#6EA8FF",
          500: "#2D7CFF",
          600: "#1E63FF",
          700: "#164ED8",
          800: "#0E2C6D",
          900: "#081328",
        },

        background: "#F7F9FC",
        surface: "#FFFFFF",

        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",

        border: "#E5E7EB",

        text: {
          primary: "#081328",
          secondary: "#64748B",
          light: "#94A3B8",
        },
      },

      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "30px",
      },

      boxShadow: {
        card: "0 8px 30px rgba(8,19,40,.08)",
        button: "0 10px 25px rgba(30,99,255,.25)",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
