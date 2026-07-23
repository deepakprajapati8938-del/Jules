/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#08090c',
        surface: {
          DEFAULT: 'rgba(255,255,255,0.035)',
          strong: 'rgba(255,255,255,0.065)',
          hover: 'rgba(255,255,255,0.08)',
        },
        border: {
          glass: 'rgba(255,255,255,0.08)',
          'glass-light': 'rgba(255,255,255,0.05)',
        },
        foreground: '#fafafa',
        secondary: '#a1a1aa',
        muted: '#71717a',
        accent: {
          DEFAULT: '#ff8a3d',
          hover: '#ff9d5c',
          tint: 'rgba(255,138,61,0.12)',
          glow: 'rgba(255,138,61,0.3)',
        },
        violet: {
          DEFAULT: '#8b5cf6',
          glow: 'rgba(139,92,246,0.3)',
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.08)',
        'glass-sm': '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.08)',
        'glass-inset': 'inset 0 1px 1px rgba(255,255,255,0.05)',
        'glow-accent': '0 0 32px rgba(255,138,61,0.4)',
        'glow-accent-sm': '0 0 16px rgba(255,138,61,0.2)',
        'glow-violet': '0 0 32px rgba(139,92,246,0.3)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #ff8a3d 0%, #ff4d8d 50%, #8b5cf6 100%)',
        'accent-gradient-subtle': 'linear-gradient(135deg, rgba(255,138,61,0.15) 0%, rgba(255,77,141,0.10) 50%, rgba(139,92,246,0.15) 100%)',
      },
      animation: {
        'ambient-breath': 'ambient-breath 15s ease-in-out infinite alternate',
        'ambient-breath-slow': 'ambient-breath 20s ease-in-out infinite alternate-reverse',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'ambient-breath': {
          '0%': { transform: 'scale(1) translate(0, 0)', opacity: 0.6 },
          '100%': { transform: 'scale(1.1) translate(2%, 2%)', opacity: 1 },
        }
      }
    },
  },
  plugins: [],
}
