module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens (light/dark via CSS variables)
        'th-base': 'var(--bg-base)',
        'th-surface': 'var(--bg-surface)',
        'th-elevated': 'var(--bg-elevated)',
        'th-card': 'var(--bg-card)',
        'th-input': 'var(--bg-input)',
        'th-hover': 'var(--bg-hover)',
        'th-text': 'var(--text-base)',
        'th-secondary': 'var(--text-secondary)',
        'th-muted': 'var(--text-muted)',
        'th-border': 'var(--border-subtle)',
        'th-border-med': 'var(--border-medium)',
        'th-border-strong': 'var(--border-strong)',
        'th-shadow': 'var(--shadow-card)',
        'th-shadow-lg': 'var(--shadow-elevated)',
        'th-shadow-modal': 'var(--shadow-modal)',
        // Spotify Green — singular brand accent, functional only
        primary: {
          50: '#eafaf0',
          100: '#c6f0d8',
          200: '#8de4b0',
          300: '#54d888',
          400: '#2ed76a',
          500: '#1ed760',   // Spotify Green — the only brand color
          600: '#1ab94f',
          700: '#169a3f',
          800: '#127c30',
          900: '#0e5e22',
        },
        // Spotify surface palette — near-black immersion
        surface: {
          50: '#ffffff',
          100: '#eeeeee',
          200: '#b3b3b3',   // Silver — secondary text
          300: '#cbcbcb',   // Near White — brighter secondary
          400: '#7c7c7c',   // Light Border
          500: '#4d4d4d',   // Border Gray
          600: '#2a2a2a',
          700: '#252525',   // Dark Card
          800: '#1f1f1f',   // Mid Dark — buttons, interactive
          900: '#181818',   // Dark Surface — cards, containers
          950: '#121212',   // Near Black — deepest background
        },
        // Semantic colors
        negative: {
          DEFAULT: '#f3727f',
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#f3727f',
          600: '#dc2626',
        },
        warning: {
          DEFAULT: '#ffa42b',
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#ffa42b',
          600: '#d97706',
        },
        announcement: {
          DEFAULT: '#539df5',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#539df5',
          600: '#2563eb',
        },
        // Status colors (functional)
        emerald: {
          50: '#eafaf0', 100: '#c6f0d8', 200: '#8de4b0', 300: '#54d888',
          400: '#2ed76a', 500: '#1ed760', 600: '#1ab94f', 700: '#169a3f',
          800: '#127c30', 900: '#0e5e22',
        },
        red: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#f3727f', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
        amber: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#ffa42b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        blue: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#539df5', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        purple: {
          50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
          400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
          800: '#6b21a8', 900: '#581c87',
        },
        cyan: {
          50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // Spotify compact typography scale
        'section': ['1.5rem', { lineHeight: 'normal', fontWeight: '700' }],
        'feature': ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body-bold': ['1rem', { lineHeight: 'normal', fontWeight: '700' }],
        'body': ['1rem', { lineHeight: 'normal', fontWeight: '400' }],
        'button-upper': ['0.875rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase' }],
        'button': ['0.875rem', { lineHeight: 'normal', fontWeight: '700', letterSpacing: '0.014em' }],
        'nav': ['0.875rem', { lineHeight: 'normal', fontWeight: '400' }],
        'nav-bold': ['0.875rem', { lineHeight: 'normal', fontWeight: '700' }],
        'caption': ['0.875rem', { lineHeight: 'normal', fontWeight: '400' }],
        'caption-bold': ['0.875rem', { lineHeight: '1.5', fontWeight: '700' }],
        'small': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        'small-bold': ['0.75rem', { lineHeight: '1.5', fontWeight: '700' }],
        'badge': ['0.65625rem', { lineHeight: '1.33', fontWeight: '600', textTransform: 'capitalize' }],
        'micro': ['0.625rem', { lineHeight: 'normal', fontWeight: '400' }],
      },
      boxShadow: {
        'sm': 'var(--shadow-card)',
        'DEFAULT': 'var(--shadow-card)',
        'md': 'var(--shadow-card)',
        'lg': 'var(--shadow-elevated)',
        'xl': 'var(--shadow-elevated)',
        '2xl': 'var(--shadow-modal)',
        'product': 'var(--shadow-elevated)',
        'none': 'none',
        'btn': 'var(--shadow-btn)',
        'input': 'var(--shadow-input)',
        'lifted': 'var(--shadow-lifted)',
        'inset': 'inset 0 0 0 1px var(--border-medium)',
        'inset-focus': 'inset 0 0 0 2px var(--spotify-green)',
      },
      borderRadius: {
        // Spotify radius scale
        'none': '0px',
        'badge': '2px',
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
        'pill': '8px',
        'full': '50%',
      },
      spacing: {
        'xxs': '4px',
        'section': '32px',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
      keyframes: {
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.2s ease-out',
        'fade-in': 'fade-in 0.35s ease-out both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    }
  },
  plugins: []
};
