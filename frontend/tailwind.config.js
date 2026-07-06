/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emeraldBrand: "#059669",
        tealBrand: "#0f766e",
        blueSoft: "#e0f2fe",
      },
    },
  },
  plugins: [],
};

