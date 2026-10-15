import { Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { currentPath, decideBack, hardwareBackTarget, lastPathInOtherSection, noteBackMove, originOf, rewindTo } from "@/lib/navigation/history";
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
 *    kthehemi shprehimisht aty prej nga erdhi (`originOf`, jo thjesht
 *    ekrani i meparshem: pas nderrimit te tab-it ai eshte tab-i tjeter).
 * 2. Levizje brenda se njejtes pjese: `router.back()` eshte i sakte dhe
 *    ruan animacionin e sistemit.
 * 3. S'ka histori fare (ekrani u hap nga njoftim, deep link ose pas nje
 *    `replace`): shkohet te `fallback`.
 */
/**
 * Kthim i shprehur te një pjesë tjetër (p.sh. Porositë → Cilësimet). Ekrani aktual hiqet më parë nga stiva e vet:
 * pa këtë "Porositë" mbetej e hapur në stivën e Dyqanit, dhe tab-i Dyqani apo "mbrapa" e radhës të çonin aty.
 */
function returnTo(path: string) {
  rewindTo(path);
  if (router.canDismiss()) router.dismiss();
  router.replace(path as Href);
}

export function goBackOr(fallback: Href) {
  const current = currentPath();
  const decision = decideBack(originOf(current), current);
  noteBackMove();

  if (decision.kind === "goto") {
    returnTo(decision.path);
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

/**
 * Butoni fizik "mbrapa" i Android-it, me të njëjtën logjikë si BackButton. true = u trajtua këtu;
 * false = e bën vetë sistemi (pop në stivë, ose tab-i i parë / dalja te rrënjët e tab-eve).
 */
export function hardwareBack(): boolean {
  const current = currentPath();
  const target = hardwareBackTarget(originOf(current), current);
  // Edhe kur kthimin e bën vetë sistemi, s'është hyrje e re në ekranin ku përfundon.
  noteBackMove();
  if (!target) return false;
  returnTo(target);
  return true;
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
