/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#141414',
        card: '#1e1e1e',
        border: '#2a2a2a',
      },
    },
  },
  plugins: [],
}
