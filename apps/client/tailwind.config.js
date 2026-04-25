/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a5c38',
          dark: '#0f3d24',
          deep: '#082a18',
          light: '#2a7a4e',
          rim: '#3d9162',
        },
        navy: {
          950: '#060b18',
          900: '#0c1528',
          800: '#152040',
          700: '#1e2f5c',
        },
        gold: {
          300: '#fde68a',
          400: '#f5c842',
          500: '#d4a017',
          600: '#b8860b',
          700: '#8b6508',
        },
        card: {
          face: '#fafaf5',
          back: '#1e3a6e',
          rim:  '#c8a96e',
        },
      },
      animation: {
        'card-deal':   'card-deal 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'chip-pop':    'chip-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        'winner-glow': 'winner-glow 1.4s ease-in-out infinite',
        'card-fold':   'card-fold 0.3s ease-in forwards',
        'chip-slide':  'chip-slide 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in-up':  'fade-in-up 0.4s ease-out both',
        'shimmer':     'shimmer 2.5s linear infinite',
        'chat-bubble': 'chat-bubble 3s ease-out forwards',
        'emoji-react': 'emoji-react 1.8s ease-out forwards',
      },
      keyframes: {
        'card-deal': {
          '0%':   { opacity: '0', transform: 'translate(-60px,-30px) rotate(-15deg) scale(0.7)' },
          '100%': { opacity: '1', transform: 'translate(0,0) rotate(0deg) scale(1)' },
        },
        'chip-pop': {
          '0%':   { opacity: '0', transform: 'scale(0.4) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'winner-glow': {
          '0%,100%': { boxShadow: '0 0 12px 2px rgba(245,200,66,.5), 0 0 28px 6px rgba(245,200,66,.2)' },
          '50%':     { boxShadow: '0 0 24px 6px rgba(245,200,66,.85), 0 0 56px 14px rgba(245,200,66,.35)' },
        },
        'card-fold': {
          '0%':   { opacity: '1', transform: 'scale(1) rotate(0deg) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.7) rotate(25deg) translateY(-10px)' },
        },
        'chip-slide': {
          '0%':   { opacity: '0', transform: 'translateY(-16px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'chat-bubble': {
          '0%':   { opacity: '0', transform: 'scale(0.6) translateY(8px)' },
          '10%':  { opacity: '1', transform: 'scale(1) translateY(0)' },
          '78%':  { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
        },
        'emoji-react': {
          '0%':   { opacity: '1', transform: 'scale(0.8) translateY(0)' },
          '20%':  { opacity: '1', transform: 'scale(1.5) translateY(-10px)' },
          '100%': { opacity: '0', transform: 'scale(1) translateY(-36px)' },
        },
      },
    },
  },
  plugins: [],
};
