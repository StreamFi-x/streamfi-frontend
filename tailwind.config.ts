import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#17191A",
        "background-2": "#1C1C1C",
        "background-3": "#151515",
        foreground: "var(--foreground)",
        primary: "#5A189A",
        offWhite: "#F1F1F1",
        'offWhite-2': "#D9D9D9",
        grayish: '#CBCBCB'
      },
      fontFamily: {
        helvetica: ["Helvetica Custom", "Arial", "sans-serif"],
      },
      spacing: {
        "8.5": "32px",
        "12.5": "50px",
        "23": "92px",
      },
      animation: {
        twinkle: "twinkle 5s linear infinite",
        "twinkle-slow": "twinkle 7s linear infinite",
        "twinkle-fast": "twinkle 3s linear infinite",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
