/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores Oficiales Tecmilenio
        'tec-azul': '#002F5D',   // Azul Marino profundo
        'tec-verde': '#8DBD3E',  // Verde Lima vibrante
        'tec-gris-claro': '#F8FAFC', // Fondo muy suave (casi blanco)
        'tec-texto': '#334155',  // Gris oscuro para textos (más suave que negro puro)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Fuente limpia
      }
    },
  },
  plugins: [],
}