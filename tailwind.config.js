/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'concord-bg': {
          primary: '#313338',
          secondary: '#2b2d31',
          tertiary: '#1e1f22',
        },
        'concord-accent': '#5865f2',
        'concord-accent-primary': '#5865f2',
        'concord-text': {
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
