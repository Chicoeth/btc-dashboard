/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#0f0f1a',
          card: '#111120',
          hover: '#161628',
        },
        brand: {
          orange: '#f7931a',
          'orange-dim': '#c4741200',
          gold: '#fbbf24',
        },
        border: {
          subtle: '#1e1e35',
          DEFAULT: '#252540',
          bright: '#3d3d6b',
        },
        text: {
          primary: '#e8e8f0',
          secondary: '#9090b0',
          muted: '#5a5a80',
          accent: '#f7931a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(-12px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
