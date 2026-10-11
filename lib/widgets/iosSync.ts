import type { WidgetSnapshot } from "@/lib/widgets/snapshot";

/**
 * Android dhe web: s'ka widget iPhone. Zbatimi i vërtetë është te
 * `iosSync.ios.ts` — i ndarë sipas platformës që Metro të mos i fusë
 * modulet e widget-eve (`@expo/ui`, fontin MaterialSymbols ~1 MB) në
 * bundle-in e Android-it, ku s'përdoren kurrë.
 */
export async function syncIosWidgets(_snapshot: WidgetSnapshot): Promise<void> {}
