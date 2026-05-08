/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'df-black': '#000000',
        'df-white': '#FFFFFF',
        'df-gray': '#AAAAAA',
        'df-border': '#333333',
        'df-orange': '#FF6200',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

