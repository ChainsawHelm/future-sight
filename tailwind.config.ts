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
        income:   'hsl(var(--income))',
        expense:  'hsl(var(--expense))',
        neutral:  'hsl(var(--neutral))',
        info:     'hsl(var(--info))',
        surface: {
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        transfer: '#6366F1',
        savings:  'hsl(var(--income))',
      },

      fontFamily: {
        sans:    ['var(--font-mono)', 'Consolas', 'Monaco', 'monospace'],
        mono:    ['var(--font-mono)', 'Consolas', 'Monaco', 'monospace'],
        display: ['var(--font-mono)', 'Consolas', 'Monaco', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        '3xs': ['0.5rem',   { lineHeight: '0.75rem' }],
      },

      borderRadius: {
        sm:    '1px',
        DEFAULT: '2px',
        md:    '2px',
        lg:    '3px',
        xl:    '4px',
        '2xl': '4px',
        '3xl': '4px',
        full:  '9999px',
      },

      animation: {
        'fade-in':     'fadeUp 0.25s ease-out both',
        'slide-up':    'slideUp 0.3s ease-out both',
        'slide-down':  'slideDown 0.25s ease-out both',
        'bar-fill':    'bar-fill 0.7s ease-out both',
        'pulse-dot':   'pulse-dot 1.5s ease-in-out infinite',
        'ring-draw':   'ring-draw 0.8s ease-out both',
        'gold-pulse':  'gold-pulse 2s ease-in-out infinite',
        'shimmer':     'shimmer 3s linear infinite',
        'float':       'float 3.5s ease-in-out infinite',
        'blink':       'blink-cursor 1s step-end infinite',
      },

      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-fill': {
          from: { transform: 'scaleX(0)', transformOrigin: 'left' },
          to:   { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.3' },
        },
        'ring-draw': {
          from: { strokeDashoffset: '502' },
        },
        'gold-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(120 100% 60% / 0)' },
          '50%':      { boxShadow: '0 0 10px 3px hsl(120 100% 60% / 0.12)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-3px)' },
        },
        'blink-cursor': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },

      boxShadow: {
        'soft':       '0 1px 2px hsl(var(--foreground) / 0.04)',
        'medium':     '0 2px 6px hsl(var(--foreground) / 0.06)',
        'gold':       '0 0 12px hsl(var(--primary) / 0.15), 0 0 30px hsl(var(--primary) / 0.05)',
        'gold-sm':    '0 0 8px hsl(var(--primary) / 0.18)',
        'glow-green': '0 0 15px hsl(var(--income) / 0.2), 0 0 30px hsl(var(--income) / 0.06)',
        'glow-red':   '0 0 15px hsl(var(--expense) / 0.2)',
        'panel':      '0 0 0 1px hsl(var(--border))',
        'inner':      'inset 0 1px 2px hsl(var(--foreground) / 0.04)',
        'card':       '0 0 8px hsl(120 100% 60% / 0.04)',
        'terminal':   '0 0 20px hsl(120 100% 60% / 0.06), inset 0 0 60px hsl(120 100% 60% / 0.02)',
      },

      backgroundImage: {
        'dot-grid':        'linear-gradient(hsl(var(--dot) / 0.5) 1px, transparent 1px)',
        'fenix-grid':      'linear-gradient(hsl(var(--dot) / 0.5) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gold-gradient':   'linear-gradient(135deg, hsl(120 100% 60%), hsl(120 100% 40%))',
        'scanlines':       'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(120 100% 60% / 0.03) 2px, hsl(120 100% 60% / 0.03) 4px)',
      },

      backgroundSize: {
        'dot':   '100% 24px',
        'fenix': '100% 24px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
