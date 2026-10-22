import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { Lora_400Regular } from "@expo-google-fonts/lora/400Regular";
import { Lora_400Regular_Italic } from "@expo-google-fonts/lora/400Regular_Italic";
import { Lora_600SemiBold } from "@expo-google-fonts/lora/600SemiBold";

/**
 * Pamja e librit. Letra e faqes është ngjyrë e vetë librit (si te lexuesit e librave), jo pjesë e temës së app-it:
 * "Letër" ditën, "Sepia" për sy të lodhur, "Natë" për leximin para gjumit me dritë të fikur.
 */
export type ReaderThemeName = "paper" | "sepia" | "night";

export type ReaderTheme = {
  /** Sfondi pas librit. */
  desk: string;
  page: string;
  text: string;
  faint: string;
  /** Vija e faqeve të grumbulluara në anë dhe ndarëset. */
  edge: string;
  /** Butonat e librit. */
  button: string;
  buttonText: string;
  /** Errësimi i faqes që kthehet. */
  shade: string;
  statusBar: "light" | "dark";
};

export const READER_THEMES: Record<ReaderThemeName, ReaderTheme> = {
  paper: {
    desk: "#ECE4D6",
    page: "#FCF8F0",
    text: "#2B2620",
    faint: "#8C8172",
    edge: "#DED3C0",
    button: "#1F3D38",
    buttonText: "#FCF8F0",
    shade: "#3B2F20",
    statusBar: "dark",
  },
  sepia: {
    desk: "#E2D2B2",
    page: "#F4E7CC",
    text: "#43362A",
    faint: "#8E7A61",
    edge: "#D6C29C",
    button: "#5B4632",
    buttonText: "#F4E7CC",
    shade: "#3B2A16",
    statusBar: "dark",
  },
  night: {
    desk: "#0F0D0B",
    page: "#1D1A16",
    text: "#D9CCB6",
    faint: "#857A69",
    edge: "#302A23",
    button: "#D9CCB6",
    buttonText: "#1D1A16",
    shade: "#000000",
    statusBar: "light",
  },
};

export const READER_THEME_ORDER: ReaderThemeName[] = ["paper", "sepia", "night"];

const SERIF_FALLBACK = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

/**
 * Shkronja e librit (Lora, me "ë" dhe "ç"). Ngarkohet vetëm te përrallat, jo në hapjen e app-it; deri atëherë
 * përdoret shkronja serif e telefonit.
 */
export function useBookFonts() {
  const [loaded] = useFonts({ Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold });
  return {
    loaded,
    body: loaded ? "Lora_400Regular" : SERIF_FALLBACK,
    italic: loaded ? "Lora_400Regular_Italic" : SERIF_FALLBACK,
    title: loaded ? "Lora_600SemiBold" : SERIF_FALLBACK,
  };
}

export type BookFonts = ReturnType<typeof useBookFonts>;
