/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        moss: { 50:"#f3f6f1",100:"#e3ebdd",200:"#c7d7bc",300:"#a3bd91",400:"#7f9f6a",500:"#5f814c",600:"#49653a",700:"#3a4f2f",800:"#2d3d25",900:"#1f2b19"},
        clay: { 50:"#fbf4ee",100:"#f4e1d1",200:"#e7bd9f",300:"#d6936a",400:"#c47445",500:"#a85a31",600:"#854727",700:"#65371f",800:"#472718",900:"#2c170e"},
        ink: "#1b2017",
        sand: "#f6f3ec"
      },
      fontFamily: {
        display: ["'Fjalla One'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    },
  },
  plugins: [],
};
