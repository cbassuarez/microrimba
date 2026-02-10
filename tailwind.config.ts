import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        rim: 'var(--rim)',
        text: 'var(--text)',
      },
      boxShadow: {
        glass: '0 12px 30px rgba(9,12,18,0.16), inset 0 1px 0 rgba(255,255,255,0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
