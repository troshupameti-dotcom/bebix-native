/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FBF6EE",
          soft: "#F3ECDD",
          line: "#E9DFCC",
        },
        ink: {
          DEFAULT: "#2C271F",
          soft: "#6B6154",
          faint: "#A79D8A",
        },
        olive: {
          DEFAULT: "#6E7452",
          bg: "#E7EAD9",
        },
        orange: {
          DEFAULT: "#C9702E",
          bg: "#F5E1CC",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F6F1E7",
        },
      },
     fontFamily: {
        display: ["Inter_700Bold"],       // H1 / tituj kryesorë / çmime / numra të rëndësishëm
        body: ["Inter_400Regular"],       // tekst i zakonshëm
        bodyMedium: ["Inter_500Medium"],  // butona, navigim, metadata
        bodySemibold: ["Inter_600SemiBold"], // section headings, card titles
        wordmark: ["Poppins_700Bold"],    // VETËM për fjalën "Bebix" në logo
      },
      borderRadius: {
        xl2: "22px",
        xl3: "28px",
      },
    },
  },
  plugins: [],
};
