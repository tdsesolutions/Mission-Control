/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          primary: '#00F0FF',
          secondary: '#7000FF',
          success: '#00FF88',
          warning: '#FFB800',
          error: '#FF3366',
          info: '#0099FF',
          dark: '#000000',
          darker: '#0A0A0F',
          panel: 'rgba(10, 10, 15, 0.85)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'orb-breathe': 'orb-breathe 4s ease-in-out infinite',
        'orb-rotate': 'orb-rotate 12s linear infinite',
        'sphere-rotate': 'sphere-rotate 20s linear infinite',
        'wave-expand': 'wave-expand 4s ease-out infinite',
        'ambient-shift': 'ambient-shift 20s ease-in-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'thinking-bounce': 'thinking-bounce 1.4s ease-in-out infinite',
      },
      keyframes: {
        'orb-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
        'orb-rotate': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'sphere-rotate': {
          from: { transform: 'rotateX(0deg) rotateY(0deg)' },
          to: { transform: 'rotateX(360deg) rotateY(360deg)' },
        },
        'wave-expand': {
          '0%': { width: '100px', height: '100px', opacity: '0.8' },
          '100%': { width: '800px', height: '800px', opacity: '0' },
        },
        'ambient-shift': {
          '0%, 100%': { backgroundPosition: '0% 0%' },
          '50%': { backgroundPosition: '100% 100%' },
        },
        'status-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'thinking-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
