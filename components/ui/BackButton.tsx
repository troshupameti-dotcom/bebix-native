import { Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";

/**
 * Kthehet një ekran mbrapa; nëse s'ka histori (ekrani u hap direkt nga një
 * njoftim, deep link, ose pas një `router.replace`), shkon te `fallback`.
 * Pa këtë, `router.back()` thjesht s'bën asgjë dhe përdoruesi ngec.
 */
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

type BackButtonProps = {
  /** Ku të shkojë kur s'ka ekran mbrapa. */
  fallback?: Href;
  /** Sjellje e veçantë (p.sh. hapi i mëparshëm i një formulari me hapa). */
  onPress?: () => void;
  /** "close" për ekranet modale (✕), "back" për të tjerat (‹). */
  variant?: "back" | "close";
  /** Vetëm hapësira (p.sh. "mr-3"), jo pamja. */
  className?: string;
};

/**
 * Butoni i vetëm i kthimit në krejt app-in: e njëjta pamje, i njëjti vend,
 * zonë prekjeje 44pt (minimumi i Apple-it), etiketë për lexuesit e ekranit,
 * dhe ngjyra që ndjekin temën.
 */
export function BackButton({ fallback = "/", onPress, variant = "back", className = "" }: BackButtonProps) {
  const isClose = variant === "close";

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        if (onPress) onPress();
        else goBackOr(fallback);
      }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={isClose ? "Mbyll" : "Kthehu"}
      style={shadows.soft}
      className={`h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70 ${className}`}
    >
      <Icon name={isClose ? "close" : "chevronLeft"} size={18} color="#2C271F" />
    </Pressable>
  );
}
