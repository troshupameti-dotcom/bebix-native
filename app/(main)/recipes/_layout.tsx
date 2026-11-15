import { Stack } from "expo-router";

/**
 * Stiva e kësaj pjese nis gjithmonë nga faqja e saj kryesore, edhe kur një faqe e brendshme hapet nga diku tjetër
 * (p.sh. një recetë nga "Ide për sot" te faqja kryesore). Pa këtë, faqja hapej e vetme në stivë dhe mbetej aty
 * pas kthimit: skeda "Ushqim" rihapej te ajo, jo te fillimi.
 */
export const unstable_settings = { anchor: "index" };

/** Skeda "Ushqim": recetat, ushqimet e para, alergjenët, plani i javës dhe lista e blerjeve. */
export default function RecipesLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
