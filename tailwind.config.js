/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{ts,tsx}','../cloudphone-ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        hud:  ['Orbitron', 'monospace'],
      },
    },
  },
  plugins: [],
}
