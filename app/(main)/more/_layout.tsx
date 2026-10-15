import { Stack } from "expo-router";

/**
 * Stiva e kësaj pjese nis gjithmonë nga faqja e saj kryesore, edhe kur një faqe e brendshme hapet nga diku tjetër
 * (p.sh. "Porositë e mia" nga Cilësimet, ose një njoftim). Pa këtë, faqja hapej e vetme në stivë dhe mbetej aty
 * pas kthimit: tab-i i kësaj pjese rihapej te ajo, jo te fillimi.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}