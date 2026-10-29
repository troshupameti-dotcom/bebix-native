import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Mënyra e fotografimit: për fotot e app-it në rrjetet sociale. Komuniteti shfaq postime shembull nga profile të
 * trilluara (psikologe, nutricioniste, pediatër, prindër) dhe askund s'del emri i vërtetë i prindit.
 *
 * Vetëm në zhvillim (`__DEV__`, pra Expo Go / build zhvillimi): në app-in e dyqaneve s'ndizet kurrë, ndaj
 * prindërit e vërtetë s'i shohin këto profile. S'shkruan asgjë në bazë.
 */
const KEY = "bebix_screenshot_mode";
let on = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function isScreenshotMode(): boolean {
  return __DEV__ && on;
}

/** Thirret një herë në nisje (app/_layout.tsx). */
export async function loadScreenshotMode(): Promise<void> {
  if (!__DEV__) return;
  try {
    on = (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    on = false;
  }
  emit();
}

export function setScreenshotMode(next: boolean): void {
  if (!__DEV__) return;
  on = next;
  void AsyncStorage.setItem(KEY, next ? "1" : "0").catch(() => {});
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScreenshotMode(): boolean {
  return useSyncExternalStore(subscribe, isScreenshotMode, isScreenshotMode);
}
