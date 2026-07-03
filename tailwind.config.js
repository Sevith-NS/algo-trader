/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#07090F",
        bgSecondary: "#0D1220",
        bgElevated: "#121A2C",
        accentGreen: "#34D399",
        accentRed: "#F87171",
        accentBlue: "#60A5FA",
        accentPurple: "#A78BFA",
        accentAmber: "#FBBF24",
        accentCyan: "#22D3EE",
        textPrimary: "#F1F5F9",
        textSecondary: "#94A3B8",
        textMuted: "#64748B",
        borderSubtle: "rgba(148, 163, 184, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.35)",
        glowGreen: "0 0 24px rgba(52, 211, 153, 0.15)",
        glowRed: "0 0 24px rgba(248, 113, 113, 0.15)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out both",
        "pulse-soft": "pulseSoft 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
}
