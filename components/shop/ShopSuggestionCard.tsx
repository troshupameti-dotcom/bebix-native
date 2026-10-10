import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { estimateDiaperStock, loadDiaperStock, type DiaperStock } from "@/lib/baby/diaperStock";
import { latestGrowth } from "@/lib/baby/growthLatest";
import { fetchAllOrders, lastDiaperItem } from "@/lib/shop/reorder";
import { monthsSince } from "@/lib/shop/age";
import { fetchAgeProducts } from "@/lib/shopData";
import {
  activeDismissals, chooseSuggestion, currentDiaperSize, diaperPrompt, pickAgeProduct, sizeUpHint, SNOOZE_MS, type Suggestion,
} from "@/lib/shop/suggestions";
import type { Product } from "@/lib/homeContent";
import type { OrderItem } from "@/lib/shop/orders";

const DISMISS_KEY = "bebix_shop_suggestion_dismissed_v1";

async function loadDismissals(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Një kartë e vetme sugjerimi për dyqanin (Home dhe Dyqani): pelenat po
 * mbarojnë → madhësia tjetër → diçka për moshën. Mbyllet me "Jo tani".
 */
export function ShopSuggestionCard({ placement = "home" }: { placement?: "home" | "shop" }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { state, addToCart, baby } = useAppState();
  const b = state.baby;

  const [stock, setStock] = useState<DiaperStock | null>(null);
  const [lastItem, setLastItem] = useState<OrderItem | null>(null);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, string> | null>(null);

  const months = monthsSince(state.profile.babyDob);

  useEffect(() => {
    let alive = true;
    void loadDismissals().then((d) => alive && setDismissals(d));
    void loadDiaperStock().then((s) => alive && setStock(s));
    void fetchAllOrders()
      .then((orders) => {
        if (!alive) return;
        setLastItem(lastDiaperItem(orders));
        setPurchased(new Set(orders.flatMap((o) => (o.status === "cancelled" ? [] : o.items.map((i) => i.id)))));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (months == null) return;
    let alive = true;
    void fetchAgeProducts(months)
      .then((list) => alive && setProducts(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [months]);

  const suggestion = useMemo((): Suggestion<Product> | null => {
    if (!dismissals) return null;
    const now = new Date();
    const dismissed = activeDismissals(dismissals, now);
    const estimate = stock ? estimateDiaperStock(stock, active(b.diaperLog)) : null;
    const sizeSetting = b.medicalInfo.find((m) => m.key === "diaper_size")?.value ?? null;
    const size = sizeUpHint(currentDiaperSize(sizeSetting, lastItem?.name), latestGrowth(b.growthHistory).weight?.value);
    return chooseSuggestion({
      diaper: diaperPrompt(estimate),
      stockKey: stock?.setAt ?? null,
      size,
      product: pickAgeProduct(products, months, purchased, dismissed),
      dismissed,
    });
  }, [dismissals, stock, b.diaperLog, b.medicalInfo, b.growthHistory, lastItem, products, months, purchased]);

  const dismiss = useCallback(
    (s: Suggestion<Product>) => {
      haptics.select();
      const until = new Date(Date.now() + SNOOZE_MS[s.kind]).toISOString();
      const next = { ...(dismissals ?? {}), [s.key]: until };
      setDismissals(next);
      AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
    },
    [dismissals]
  );

  if (!suggestion) return null;
  const babyName = state.profile.nickname || state.profile.babyName || t("your_baby");

  function reorder() {
    haptics.success();
    if (!lastItem) {
      router.push({ pathname: "/(main)/shop", params: { q: "pelena" } });
      return;
    }
    // Një prekje: të njëjtat pelena, e njëjta sasi, drejt te përfundimi i porosisë.
    addToCart({ id: lastItem.id, name: lastItem.name, price: lastItem.price, imageUrl: lastItem.imageUrl ?? null, icon: lastItem.icon ?? "cube" }, lastItem.qty);
    showToast(t("diaper_stock_added"));
    router.push("/shop/checkout");
  }

  const tone: Tone = suggestion.kind === "diaper" ? TONES.amber : suggestion.kind === "size" ? TONES.blue : TONES.green;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 240 }}
      style={[shadows.soft, { backgroundColor: tone.tintBg }]}
      className={`${placement === "home" ? "mt-5" : "mb-4"} rounded-xl3 p-4`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/70">
          <Icon name={suggestion.kind === "product" ? "sparkle" : "diaper"} size={16} color={tone.tint} />
        </View>
        <View className="flex-1">
          {suggestion.kind === "diaper" ? (
            <>
              <Text className="font-bodySemibold text-[15px]" style={{ color: "#17212B" }}>
                {suggestion.prompt.daysLeft > 0 ? t("shop_sugg_diaper_days", { n: suggestion.prompt.daysLeft }) : t("shop_sugg_diaper_now")}
              </Text>
              <Text className="mt-0.5 font-body text-[13px]" style={{ color: "#3B4652" }}>
                {lastItem ? t("shop_sugg_diaper_same", { name: lastItem.name, qty: lastItem.qty }) : t("diaper_stock_left", { n: suggestion.prompt.left })}
              </Text>
            </>
          ) : suggestion.kind === "size" ? (
            <>
              <Text className="font-bodySemibold text-[15px]" style={{ color: "#17212B" }}>
                {t(suggestion.hint.urgent ? "shop_sugg_size_now" : "shop_sugg_size_soon", { n: suggestion.hint.next.size })}
              </Text>
              <Text className="mt-0.5 font-body text-[13px]" style={{ color: "#3B4652" }}>
                {t("shop_sugg_size_body", {
                  name: babyName,
                  w: suggestion.hint.weightKg,
                  cur: suggestion.hint.current.size,
                  n: suggestion.hint.next.size,
                  min: suggestion.hint.next.minKg,
                  max: suggestion.hint.next.maxKg,
                })}
              </Text>
            </>
          ) : (
            <Pressable onPress={() => router.push(`/shop/${suggestion.product.id}`)} accessibilityRole="button" className="flex-row items-center gap-3">
              {suggestion.product.imageUrl ? (
                <Image source={{ uri: suggestion.product.imageUrl }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff" }} />
              ) : null}
              <View className="flex-1">
                <Text className="font-bodyMedium text-[12.5px]" style={{ color: "#3B4652" }}>
                  {t("shop_sugg_age", { name: babyName, n: months ?? 0 })}
                </Text>
                <Text className="font-bodySemibold text-[15px]" style={{ color: "#17212B" }} numberOfLines={2}>
                  {suggestion.product.name}
                </Text>
                <Price price={suggestion.product.price} compareAt={suggestion.product.compareAtPrice} size="sm" />
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        {suggestion.kind === "diaper" ? (
          <Pressable onPress={reorder} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full bg-ink px-4" style={{ minHeight: 48 }}>
            <Text className="font-bodySemibold text-[14px] text-cream" numberOfLines={1}>
              {lastItem ? t("shop_sugg_diaper_yes") : t("diaper_stock_find")}
            </Text>
          </Pressable>
        ) : suggestion.kind === "size" ? (
          <>
            <Pressable
              onPress={() => router.push({ pathname: "/(main)/shop", params: { q: "pelena" } })}
              accessibilityRole="button"
              className="flex-1 items-center justify-center rounded-full bg-ink px-4"
              style={{ minHeight: 48 }}
            >
              <Text className="font-bodySemibold text-[14px] text-cream">{t("shop_sugg_size_see", { n: suggestion.hint.next.size })}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                baby.updateMedicalRow("diaper_size", { value: String(suggestion.hint.next.size) });
                showToast(t("shop_sugg_size_saved", { n: suggestion.hint.next.size }));
                dismiss(suggestion);
              }}
              accessibilityRole="button"
              className="items-center justify-center rounded-full bg-white/70 px-4"
              style={{ minHeight: 48 }}
            >
              <Text className="font-bodySemibold text-[13px]" style={{ color: tone.tint }}>
                {t("shop_sugg_size_done", { n: suggestion.hint.next.size })}
              </Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          onPress={() => dismiss(suggestion)}
          accessibilityRole="button"
          className={`${suggestion.kind === "product" ? "flex-1" : ""} items-center justify-center rounded-full px-4`}
          style={{ minHeight: 48 }}
        >
          <Text className="font-bodyMedium text-[13px]" style={{ color: "#5C6670" }}>
            {t("shop_sugg_not_now")}
          </Text>
        </Pressable>
      </View>
    </MotiView>
  );
}
