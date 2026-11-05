import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, Image, Modal, ScrollView, Animated, Easing, PanResponder, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { ShopSubcategory } from "@/lib/shopData";

const GAP = 12;
const SHEET_GAP = 14;
const SHEET_PADDING_X = 20;

/**
 * Piedestali: një katror i ngrohtë ku fotoja e produktit pushon pa kornizë. Fotot kanë sfond të bardhë dhe
 * `mixBlendMode: "multiply"` e tret atë në ngjyrën e piedestalit. Mbetet i çelët edhe në temën e errët, që fotot të
 * mos errësohen. E njëjta formë si te webi (SubcategoryTile).
 */
const plinthColor = (isDark: boolean) => (isDark ? "#E4DCD1" : "#EFE8DE");

/** Fotoja brenda piedestalit. Qoshet e rrumbullakëta duken vetëm aty ku përzierja s'punon (Android para 10). */
function Photo({ uri, size, inset }: { uri: string; size: number; inset: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: size * inset,
        top: size * inset,
        width: size * (1 - inset * 2),
        height: size * (1 - inset * 2),
        borderRadius: size * 0.12,
        overflow: "hidden",
        mixBlendMode: "multiply",
      }}
    >
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

/** Katër foto të vogla: butoni "Të gjitha" tregon çfarë ka brenda. Katrorët pa foto bëhen vetë shenja e rrjetës. */
function Mosaic({ covers, size }: { covers: string[]; size: number }) {
  const inset = size * 0.14;
  const inner = size - inset * 2;
  const gap = inner * 0.09;
  const cell = (inner - gap) / 2;
  return (
    <View style={{ position: "absolute", left: inset, top: inset, width: inner, height: inner, flexDirection: "row", flexWrap: "wrap", gap }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: cell, height: cell, borderRadius: cell * 0.26, backgroundColor: "rgba(255,255,255,0.6)" }}>
          {covers[i] ? <Photo uri={covers[i]} size={cell} inset={0.1} /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Një pllakë: piedestali, emri dhe numri. E zgjedhura merr unazën dhe një shenjë: × te rreshti (prekja e heq
 * zgjedhjen), ✓ brenda dritares (aty zgjidhet). `backdrop` është ngjyra pas pllakës, për hapësirën rreth shenjës.
 */
function Tile({
  size,
  label,
  count,
  active,
  mark,
  a11y,
  onPress,
  children,
  corner,
}: {
  size: number;
  label: string;
  count: string;
  active: boolean;
  mark: "clear" | "check";
  a11y: string;
  onPress: () => void;
  children: ReactNode;
  corner?: ReactNode;
}) {
  const theme = useThemeColors();
  const radius = Math.round(size * 0.24);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active }}
      style={{ width: size }}
      className="items-center"
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: plinthColor(theme.isDark),
              isolation: "isolate",
              transform: [{ scale: pressed ? 0.96 : 1 }],
            }}
          >
            {children}
          </View>
          {active && (
            <>
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: -4, left: -4, width: size + 8, height: size + 8, borderRadius: radius + 4, borderWidth: 2, borderColor: theme.olive }}
              />
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: theme.cream, backgroundColor: theme.olive, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name={mark === "check" ? "check" : "close"} size={mark === "check" ? 12 : 10} color={theme.cream} />
              </View>
            </>
          )}
          {corner}
          <Text
            numberOfLines={2}
            className={`mt-2 text-center text-[11.5px] leading-[14px] ${active ? "font-bodySemibold text-ink" : "font-bodyMedium text-ink-soft"}`}
          >
            {label}
          </Text>
          <Text className="mt-0.5 font-body text-[10.5px] text-ink-faint">{count}</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Dritarja nga poshtë me të gjitha nënkategoritë. Stilet janë të shkruara drejt (jo me `className` mbi një pamje
 * të animuar), që sfondi dhe qoshet të dalin njësoj në Android, iOS dhe web. Mbyllet me ×, me prekje jashtë, me
 * butonin "Mbrapa" ose duke e tërhequr poshtë nga koka (mbi 90 px).
 */
function Sheet({ visible, onClose, header, children }: { visible: boolean; onClose: () => void; header: (close: () => void) => ReactNode; children: ReactNode }) {
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Vlera e animuar krijohet një herë (useState, jo ref: s'lexohet gjatë vizatimit).
  const [offset] = useState(() => new Animated.Value(height));

  useEffect(() => {
    if (!visible) return;
    offset.setValue(height);
    Animated.timing(offset, { toValue: 0, duration: 360, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [visible, height, offset]);

  const close = useCallback(
    () => Animated.timing(offset, { toValue: height, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onClose()),
    [offset, height, onClose],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 1.2) close();
          else Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
      }),
    [offset, close],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={close} />
        <Animated.View
          style={{
            transform: [{ translateY: offset }],
            maxHeight: height * 0.88,
            backgroundColor: theme.cream,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View {...pan.panHandlers} style={{ paddingTop: 10, paddingHorizontal: SHEET_PADDING_X, paddingBottom: 4 }}>
            <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: theme.creamLine, marginBottom: 14 }} />
            {header(close)}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SHEET_PADDING_X, paddingBottom: 12 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Nënkategoritë e kategorisë së hapur, pa rrëshqitje anash: aq pllaka sa zënë një rresht (3 në telefon) dhe e fundit
 * është "Të gjitha", një mozaik me fotot e atyre që s'dalin, që hap dritaren me të gjitha. E zgjedhura del gjithmonë
 * në rresht. I njëjti dizajn si webi në telefon.
 */
export function SubcategoryGrid({
  subcategories,
  active,
  categoryLabel,
  width,
  onSelect,
}: {
  subcategories: ShopSubcategory[];
  active: string | null;
  categoryLabel: string;
  /** Gjerësia e rreshtit (pa mbushjen anash të faqes). */
  width: number;
  onSelect: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const hide = useCallback(() => setOpen(false), []);

  // Rreth 96 px për pllakë: 4 kolona në telefon (3 + "Të gjitha"), më shumë në tablet.
  const columns = Math.min(9, Math.max(4, Math.round((width + GAP) / (96 + GAP))));
  const size = (width - GAP * (columns - 1)) / columns;
  const visible = columns - 1;

  const count = (n: number) => (n === 1 ? t("shop_sub_count_one") : t("shop_sub_count", { n }));
  const total = subcategories.reduce((sum, s) => sum + s.count, 0);
  const activeIndex = subcategories.findIndex((s) => s.key === active);
  // E zgjedhura s'fshihet pas "Të gjitha": nëse është më poshtë, zë vendin e të fundit të dukshme.
  const shown = (i: number) => (activeIndex >= visible ? (i < visible - 1 || i === activeIndex) : i < visible);
  const hidden = Math.max(0, subcategories.length - visible);
  const mosaic = [...subcategories.filter((_, i) => !shown(i)), ...subcategories.filter((_, i) => shown(i))].flatMap((s) =>
    s.coverUrl ? [s.coverUrl] : [],
  );

  // Dritarja: 3 kolona në telefon, deri në 6 në tablet.
  const sheetWidth = windowWidth - SHEET_PADDING_X * 2;
  const sheetColumns = Math.min(6, Math.max(3, Math.round((sheetWidth + SHEET_GAP) / (110 + SHEET_GAP))));
  const sheetSize = (sheetWidth - SHEET_GAP * (sheetColumns - 1)) / sheetColumns;

  const choose = (key: string | null) => {
    haptics.select();
    setOpen(false);
    onSelect(key);
  };

  const photo = (s: ShopSubcategory, at: number) =>
    s.coverUrl ? (
      <Photo uri={s.coverUrl} size={at} inset={0.12} />
    ) : (
      <View className="absolute inset-0 items-center justify-center">
        <Text style={{ fontSize: at * 0.36 }}>{s.emoji ?? "🍼"}</Text>
      </View>
    );

  return (
    <>
      <View accessibilityLabel={t("shop_subcategories")} style={{ flexDirection: "row", gap: GAP }}>
        {subcategories.map((s, i) =>
          shown(i) ? (
            <Tile
              key={s.id}
              size={size}
              label={s.label}
              count={count(s.count)}
              active={s.key === active}
              mark="clear"
              a11y={`${s.label}, ${count(s.count)}${s.key === active ? `, ${t("shop_sub_clear")}` : ""}`}
              onPress={() => {
                haptics.select();
                onSelect(s.key === active ? null : s.key);
              }}
            >
              {photo(s, size)}
            </Tile>
          ) : null,
        )}
        <Tile
          size={size}
          label={t("shop_all_chip")}
          count={t("shop_sub_kinds_short", { n: subcategories.length })}
          active={false}
          mark="clear"
          a11y={t("shop_sub_more")}
          onPress={() => {
            haptics.tap();
            setOpen(true);
          }}
          corner={
            hidden > 0 ? (
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: size - 18, right: -5, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, borderWidth: 3, borderColor: theme.cream, backgroundColor: theme.ink, alignItems: "center", justifyContent: "center" }}
              >
                <Text className="font-bodySemibold text-[10.5px] text-cream">+{hidden}</Text>
              </View>
            ) : null
          }
        >
          <Mosaic covers={mosaic} size={size} />
        </Tile>
      </View>

      <Sheet
        visible={open}
        onClose={hide}
        header={(close) => (
          <View className="flex-row items-start justify-between" style={{ gap: 16 }}>
            <View className="flex-1">
              <Text className="font-bodySemibold text-xl text-ink">{categoryLabel}</Text>
              <Text className="mt-1 font-body text-[13px] text-ink-faint">
                {t("shop_sub_kinds", { n: subcategories.length })} · {count(total)}
              </Text>
            </View>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t("close_action")}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-cream-soft active:opacity-70"
            >
              <Icon name="close" size={16} color={theme.ink} />
            </Pressable>
          </View>
        )}
      >

        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 380, delay: 90 }}>
          <Pressable
            onPress={() => choose(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !active }}
            accessibilityLabel={`${t("shop_sub_all_products")}, ${count(total)}`}
            className="mt-4 flex-row items-center rounded-[22px] p-2.5 pr-4 active:opacity-80"
            style={{ gap: 14, borderWidth: active ? 1 : 2, borderColor: active ? theme.creamLine : theme.olive }}
          >
            <View className="flex-row">
              {mosaic.slice(0, 3).map((uri, i) => (
                <View
                  key={uri}
                  style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", marginLeft: i ? -12 : 0, borderWidth: 2.5, borderColor: theme.cream, backgroundColor: plinthColor(theme.isDark), isolation: "isolate" }}
                >
                  <Photo uri={uri} size={35} inset={0.14} />
                </View>
              ))}
            </View>
            <View className="flex-1">
              <Text className="font-bodySemibold text-[15px] text-ink">{t("shop_sub_all_products")}</Text>
              <Text className="mt-0.5 font-body text-xs text-ink-faint">{count(total)}</Text>
            </View>
            {!active ? (
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: theme.olive }}>
                <Icon name="check" size={12} color={theme.cream} />
              </View>
            ) : (
              <Icon name="chevronRight" size={16} color={theme.inkFaint} />
            )}
          </Pressable>
        </MotiView>

        <Text className="mb-3.5 mt-7 font-bodySemibold text-[11px] uppercase tracking-[1.5px] text-ink-faint">{t("shop_subcategories")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: SHEET_GAP, rowGap: 20, paddingBottom: 8 }}>
          {subcategories.map((s, i) => (
            <MotiView
              key={s.id}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 420, delay: 150 + i * 32 }}
            >
              <Tile
                size={sheetSize}
                label={s.label}
                count={count(s.count)}
                active={s.key === active}
                mark="check"
                a11y={`${s.label}, ${count(s.count)}`}
                onPress={() => choose(s.key)}
              >
                {photo(s, sheetSize)}
              </Tile>
            </MotiView>
          ))}
        </View>
      </Sheet>
    </>
  );
}
