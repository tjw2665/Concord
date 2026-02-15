/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ass-bg': {
          primary: '#313338',
          secondary: '#2b2d31',
          tertiary: '#1e1f22',
        },
        'ass-accent': '#5865f2',
        'ass-text': {
          primary: '#f2f3f5',
          secondary: '#b5bac1',
        },
      },
      fontFamily: {
        sans: ['gg sans', 'Noto Sans', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
