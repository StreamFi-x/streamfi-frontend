import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}", // Important: includes your data files
    "./lib/**/*.{js,ts,jsx,tsx,mdx}", // Important: includes your theme-classes.ts
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Your custom colors
        "background-2": "var(--background-2)",
        "background-3": "var(--background-3)",
        "background-4": "var(--background-4)",
        lightPrimary: "var(--lightPrimary)",
        purples: "var(--purples)",
        offWhite: "var(--offWhite)",
        "offWhite-2": "var(--offWhite-2)",
        grayish: "var(--grayish)",
        grayish2: "var(--grayish2)",
        // Chart colors
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        helvetica: ["Helvetica Custom", "Arial", "sans-serif"],
        "pp-neue": ["PP Neue Machina", "sans-serif"],
        inter: ["Inter", "sans-serif"],
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
  plugins: [require("tailwindcss-animate")],
};

export default config;
