module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#1e293b',
          800: '#1a1f2e',
          850: '#151923',
          900: '#0f1219',
          950: '#0a0d14',
        }
      }
    }
  },
  plugins: []
};
