/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: '#0A0E17',
        bgSecondary: '#121826',
        bgGlass: 'rgba(18, 24, 38, 0.6)',
        textPrimary: '#FFFFFF',
        textSecondary: '#94A3B8',
        accentGreen: '#00FF88',
        accentRed: '#FF3366',
        accentBlue: '#3B82F6',
        accentPurple: '#8B5CF6',
        borderSubtle: 'rgba(255, 255, 255, 0.1)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
