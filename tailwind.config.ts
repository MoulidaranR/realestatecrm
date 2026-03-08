import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"]
      },
      colors: {
        primary: {
          DEFAULT: "#7C3AED",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F8F9FB",
          subtle: "#F1F5F9"
        },
        border: {
          DEFAULT: "#E2E8F0",
          strong: "#CBD5E1"
        },
        text: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
          disabled: "#CBD5E1"
        },
        success: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          600: "#16A34A",
          700: "#15803D"
        },
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          600: "#D97706",
          700: "#B45309"
        },
        danger: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          600: "#E11D48",
          700: "#BE123C"
        },
        info: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          600: "#2563EB",
          700: "#1D4ED8"
        }
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px"
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
        modal: "0 20px 60px -10px rgba(0,0,0,0.15)"
      },
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "18": "4.5rem"
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)"
      }
    }
  },
  plugins: []
};

export default config;
