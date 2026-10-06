import { Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { previousPath, currentPath, decideBack, lastPathInOtherSection, rewindTo } from "@/lib/navigation/history";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Kthehet aty ku ishte perdoruesi vertet.
 *
 * Tre raste, me kete radhe:
 *
 * 1. Erdhi nga nje pjese tjeter e app-it (p.sh. "Me shume" -> "Porosite e
 *    mia", qe rri te Dyqani). `router.back()` do ta kthente brenda
 *    Dyqanit, sepse aty u shtua ekrani — jo te "Me shume". Prandaj
 *    kthehemi shprehimisht te rruga e meparshme.
 * 2. Levizje brenda se njejtes pjese: `router.back()` eshte i sakte dhe
 *    ruan animacionin e sistemit.
 * 3. S'ka histori fare (ekrani u hap nga njoftim, deep link ose pas nje
 *    `replace`): shkohet te `fallback`.
 */
export function goBackOr(fallback: Href) {
  const current = currentPath();
  const decision = decideBack(previousPath(), current);

  if (decision.kind === "goto") {
    rewindTo(decision.path);
    router.replace(decision.path as Href);
    return;
  }

  if (router.canGoBack()) {
    router.back();
    return;
  }

  // Fundi i stivës native, por ekrani mund të jetë arritur përmes disa
  // hapave brenda së njëjtës pjesë (shih lastPathInOtherSection) — kërko
  // më thellë në histori para se të dorëzohesh te fallback-u statik.
  const other = lastPathInOtherSection(current);
  if (other) rewindTo(other);
  router.replace((other ?? fallback) as Href);
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
  const { t } = useTranslation();
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
      accessibilityLabel={isClose ? t("a11y_close") : t("a11y_back")}
      style={shadows.soft}
      className={`h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70 ${className}`}
    >
      <Icon name={isClose ? "close" : "chevronLeft"} size={18} color="#2C271F" />
    </Pressable>
  );
}
