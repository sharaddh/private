module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f1f5f9',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          750: '#172032',
          800: '#131826',
          850: '#0e121f',
          900: '#0a0d17',
          950: '#060810',
        },
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffb',
          300: '#7cc5f8',
          400: '#36a9f3',
          500: '#0c8ee7',
          600: '#0070c4',
          700: '#01599f',
          800: '#064c83',
          900: '#0b406d',
        },
        accent: {
          50: '#fdf4f3',
          100: '#fce7e5',
          200: '#f9d3ce',
          300: '#f4b2a9',
          400: '#ec887a',
          500: '#e06351',
          600: '#cc4834',
          700: '#ab3928',
          800: '#8e3325',
          900: '#772f24',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 40px -8px rgba(0, 0, 0, 0.06), 0 2px 10px -2px rgba(0, 0, 0, 0.03)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0,0,0,0.02)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    }
  },
  plugins: []
};
