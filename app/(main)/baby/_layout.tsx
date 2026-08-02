import { Stack } from "expo-router";

/**
 * Native push/pop stack for everything inside the Baby module. The
 * profile hub (`index`) is the root; Feeding/Sleep/Diaper/Growth/
 * Vaccinations/Settings all push on top of it with the platform's
 * native slide-from-right transition.
 */
export default function BabyLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
