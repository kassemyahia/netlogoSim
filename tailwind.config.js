/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bluebits: {
          light: '#EBF5FC',
          DEFAULT: '#1D76BC',
          dark: '#363B8E',
          charcoal: '#232323'
        }
      },
      fontFamily: {
        sans: ['"Hacen Algeria"', '"Boutros Dinkum"', '"VIP Hala Bold"', 'Cairo', 'sans-serif'],
        display: ['"VIP Hala Bold"', '"Hacen Algeria"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}