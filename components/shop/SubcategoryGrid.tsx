import { View, Text, Pressable } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { ShopSubcategory } from "@/lib/shopData";

const GAP = 8;
/** Gjerësia më e vogël e pllakës: 2 kolona në telefon, 4 në tablet, si te webi. */
const MIN_TILE = 172;

/** Ikona sipas çelësit të nënkategorisë, të njëjtat si te webi. Nënkategoria që s'është këtu merr tre pikat. */
const ICONS: Record<string, IconName> = {
  "biberon-qetesues": "soother",
  setet: "gift",
  shishet: "babyBottle",
  "biberonet-thithkat": "teat",
  gotat: "cup",
  "kapese-per-biberon": "clip",
  "aksesore-per-dhembezim": "tooth",
  "higjiena-orale": "toothbrush",
  "kujdesi-gjate-gjidhenie": "nursing",
  ushqyerja: "bowl",
  "te-tjera": "more",
};

/**
 * Një pllakë: kutia me ikonën, emri dhe numri. E zgjedhura merr unazën e errët (si kategoria e zgjedhur) dhe kutinë
 * e mbushur. Pa `onPress` është "Së shpejti": e zbehur dhe s'preket.
 */
function Tile({ width, icon, label, note, active, a11y, onPress }: {
  width: number;
  icon: IconName;
  label: string;
  note: string;
  active: boolean;
  a11y: string;
  onPress?: () => void;
}) {
  const theme = useThemeColors();
  const narrow = width < 150;
  const body = (pressed: boolean) => (
    <View
      style={{
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: narrow ? 8 : 10,
        paddingHorizontal: narrow ? 8 : 10,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? "transparent" : theme.creamLine,
        backgroundColor: theme.surface,
        opacity: onPress ? (pressed ? 0.8 : 1) : 0.6,
      }}
    >
      <View
        style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.ink : theme.creamSoft }}
      >
        <Icon name={icon} size={28} color={active ? theme.onAccent : theme.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={3} className={`font-bodySemibold text-[13px] leading-4 ${onPress ? "text-ink" : "text-ink-faint"}`}>
          {label}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 font-body text-xs text-ink-faint">{note}</Text>
      </View>
      {active ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: -4, right: -4, bottom: -4, left: -4, borderRadius: 20, borderWidth: 2, borderColor: theme.ink }}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} accessibilityState={{ disabled: true }} style={{ width }}>
        {body(false)}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: active }} style={{ width }}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/**
 * Nënkategoritë e kategorisë së hapur, si te webi: "Të gjitha" dhe çdo nënkategori në një rrjetë pa rrëshqitje
 * (2 kolona në telefon). Ato pa produkte dalin si "Së shpejti". Prekja e së zgjedhurës e heq zgjedhjen.
 */
export function SubcategoryGrid({
  subcategories,
  active,
  width,
  onSelect,
}: {
  subcategories: ShopSubcategory[];
  active: string | null;
  /** Gjerësia e rrjetës (pa mbushjen anash të faqes). */
  width: number;
  onSelect: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const columns = Math.max(2, Math.min(6, Math.floor((width + GAP) / (MIN_TILE + GAP))));
  const tileWidth = Math.floor((width - GAP * (columns - 1)) / columns);
  const count = (n: number) => (n === 1 ? t("shop_sub_count_one") : t("shop_sub_count", { n }));
  const total = subcategories.reduce((sum, s) => sum + s.count, 0);
  const choose = (key: string | null) => {
    haptics.select();
    onSelect(key);
  };

  return (
    <View accessibilityLabel={t("shop_subcategories")} style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
      <Tile
        width={tileWidth}
        icon="grid"
        label={t("shop_all_chip")}
        note={total > 0 ? count(total) : t("soon_title")}
        active={!active}
        a11y={`${t("shop_all_chip")}, ${total > 0 ? count(total) : t("soon_title")}`}
        onPress={total > 0 ? () => choose(null) : undefined}
      />
      {subcategories.map((s) => {
        const on = s.key === active;
        const note = s.count > 0 ? count(s.count) : t("soon_title");
        return (
          <Tile
            key={s.id}
            width={tileWidth}
            icon={ICONS[s.key] ?? "more"}
            label={s.label}
            note={note}
            active={on}
            a11y={`${s.label}, ${note}${on ? `, ${t("shop_sub_clear")}` : ""}`}
            onPress={s.count > 0 ? () => choose(on ? null : s.key) : undefined}
          />
        );
      })}
    </View>
  );
}
