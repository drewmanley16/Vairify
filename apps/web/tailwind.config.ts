import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { accent: { DEFAULT: "#0f766e", foreground: "#ffffff" } }, borderRadius: { xl: "1rem" } } },
  plugins: [],
};
export default config;
