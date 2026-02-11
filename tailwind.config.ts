import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        condensed: ['"IBM Plex Sans Condensed"', 'system-ui', 'sans-serif'],
        smufl: ['HEJI2', 'Bravura', 'serif'],
        hejiText: ['HEJI2Text', '"IBM Plex Sans Condensed"', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: 'var(--surface)',
        rim: 'var(--rim)',
        text: 'var(--text)',
      },
      boxShadow: {
        glass: '0 18px 48px rgba(7, 12, 24, 0.22), inset 0 1px 0 rgba(255,255,255,0.28)',
      },
    },
  },
  plugins: [],
} satisfies Config;
