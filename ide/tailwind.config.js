/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        // Cyberpunk-88 令牌（与 components/visualization/theme/tokens.ts 对齐）
        yyc3: {
          bg: "#0d1117",
          elevated: "#161b22",
          cyan: "#06b6d4",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
