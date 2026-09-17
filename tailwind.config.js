/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");
const { light, dark, toRgbChannels, cssVar } = require("./theme/palette");

/** Klasa që lexon variablën e temës dhe mban mbështetjen për `/opacity`. */
const token = (name) => `rgb(var(${cssVar(name)}) / <alpha-value>)`;

/** Variablat e një teme, në formën që pret addBase. */
const varsFor = (palette) =>
  Object.fromEntries(Object.entries(palette).map(([name, hex]) => [cssVar(name), toRgbChannels(hex)]));

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Tema zgjidhet nga përdoruesi (Më shumë → Pamja) përmes setColorScheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: token("cream"),
          soft: token("creamSoft"),
          line: token("creamLine"),
        },
        ink: {
          DEFAULT: token("ink"),
          soft: token("inkSoft"),
          faint: token("inkFaint"),
        },
        olive: {
          DEFAULT: token("olive"),
          bg: token("oliveBg"),
        },
        orange: {
          DEFAULT: token("orange"),
          bg: token("orangeBg"),
        },
        surface: {
          DEFAULT: token("surface"),
          alt: token("surfaceAlt"),
        },
        "on-accent": token("onAccent"),
      },
      fontFamily: {
        display: ["Inter_700Bold"], // H1 / tituj kryesorë / çmime / numra të rëndësishëm
        body: ["Inter_400Regular"], // tekst i zakonshëm
        bodyMedium: ["Inter_500Medium"], // butona, navigim, metadata
        bodySemibold: ["Inter_600SemiBold"], // section headings, card titles
        wordmark: ["Poppins_700Bold"], // VETËM për fjalën "Bebix" në logo
      },
      borderRadius: {
        xl2: "22px",
        xl3: "28px",
      },
    },
  },
  plugins: [
    // Variablat e ngjyrave: light si parazgjedhje, dark kur tema është e errët.
    plugin(({ addBase }) => {
      addBase({
        ":root": varsFor(light),
        ".dark:root": varsFor(dark),
      });
    }),
  ],
};
