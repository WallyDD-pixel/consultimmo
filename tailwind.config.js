/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#30345d',
        secondary: {
          DEFAULT: '#f8fafc', // blanc nacré
          light: '#f4f6fb',
        },
        accent: {
          400: '#ffa700',
          500: '#ff9900',
          600: '#ff6600',
        },
        surface: '#ffffff',
        surfaceAlt: '#f8fafc',
        border: '#e6eaf2',
        text: {
          primary: '#0f172a',
          muted: '#64748b',
        },
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 8px 32px rgba(31,38,135,.12)',
      },
    },
  },
  plugins: [],
};
