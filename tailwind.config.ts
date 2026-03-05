import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Financial semantic colors (CSS variable-backed)
        income:   'hsl(var(--income))',
        expense:  'hsl(var(--expense))',
        neutral:  'hsl(var(--neutral))',
        info:     'hsl(var(--info))',
        // Surface layers
        surface: {
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        // Static fallback (for compatibility)
        navy: {
          DEFAULT: '#1B3A5C',
          300: '#7596BA',
          400: '#4773A3',
          500: '#1B3A5C',
        },
        transfer: '#6366F1',
        savings:  'hsl(var(--income))',
      },

      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'Consolas', 'monospace'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        '3xs': ['0.5rem',   { lineHeight: '0.75rem' }],
      },

      borderRadius: {
        sm:  '0.125rem',
        DEFAULT: '0.25rem',
        md:  '0.25rem',
        lg:  '0.375rem',
        xl:  '0.5rem',
        '2xl': '0.75rem',
        full: '9999px',
      },

      animation: {
        'fade-in':     'fadeUp 0.3s ease-out both',
        'slide-up':    'slideUp 0.35s ease-out both',
        'slide-down':  'slideDown 0.3s ease-out both',
        'bar-fill':    'bar-fill 0.6s ease-out both',
        'pulse-dot':   'pulse-dot 2s ease-in-out infinite',
        'ring-draw':   'ring-draw 0.8s ease-out both',
      },

      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-fill': {
          from: { transform: 'scaleX(0)', transformOrigin: 'left' },
          to:   { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.75)' },
        },
        'ring-draw': {
          from: { strokeDashoffset: '502' },
        },
      },

      boxShadow: {
        'glow-green': '0 0 20px hsl(var(--income) / 0.2), 0 0 40px hsl(var(--income) / 0.08)',
        'glow-red':   '0 0 20px hsl(var(--expense) / 0.2)',
        'panel':      '0 1px 0 hsl(var(--border)), 0 0 0 1px hsl(var(--border) / 0.5)',
        'inner-glow': 'inset 0 1px 0 hsl(var(--foreground) / 0.04)',
      },

      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, hsl(var(--dot)) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },

      backgroundSize: {
        'dot': '28px 28px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
