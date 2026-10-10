import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { estimateDiaperStock, loadDiaperStock, saveDiaperStock, type DiaperStock } from "@/lib/baby/diaperStock";
import { fetchAllOrders, lastDiaperItem } from "@/lib/shop/reorder";
import type { OrderItem } from "@/lib/shop/orders";

/**
 * "Pelenat e mbetura": prindi vendos sa pelena ka, Bebix i numëron vetë nga
 * ditari dhe, para se të mbarojnë, ofron porosinë me një prekje (të njëjtat pelena
 * që ka blerë herën e fundit, ose kërkimin e pelenave kur s'ka blerë ende).
 */
export function DiaperStockCard({ entries }: { entries: { at: string }[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { addToCart } = useAppState();
  const { showToast } = useToast();
  const [stock, setStock] = useState<DiaperStock | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [lastItem, setLastItem] = useState<OrderItem | null>(null);

  useEffect(() => {
    let alive = true;
    void loadDiaperStock().then((s) => {
      if (!alive) return;
      setStock(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const estimate = useMemo(() => (stock ? estimateDiaperStock(stock, entries) : null), [stock, entries]);

  // Pelenat e blera herën e fundit kërkohen vetëm kur duhet porositur.
  useEffect(() => {
    if (!estimate?.low) return;
    let alive = true;
    void fetchAllOrders().then((orders) => {
      if (alive) setLastItem(lastDiaperItem(orders));
    });
    return () => {
      alive = false;
    };
  }, [estimate?.low]);

  async function save() {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setStock(await saveDiaperStock(n));
    setEditing(false);
    setValue("");
    haptics.success();
  }

  function order() {
    haptics.select();
    if (lastItem) {
      addToCart({ id: lastItem.id, name: lastItem.name, price: lastItem.price, imageUrl: lastItem.imageUrl ?? null, icon: lastItem.icon ?? "cube" }, lastItem.qty);
      showToast(t("diaper_stock_added"));
      // Një prekje: drejt te përfundimi i porosisë, jo te shporta.
      router.push("/shop/checkout");
    } else {
      router.push({ pathname: "/(main)/shop", params: { q: "pelena" } });
    }
  }

  if (!loaded) return null;

  // Pa numër ose gjatë ndryshimit: pyetja e vetme.
  if (!stock || editing) {
    return (
      <View style={shadows.soft} className="mb-5 rounded-xl2 bg-surface p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="diaper" size={16} color="#6E7452" />
          <Text className="font-bodySemibold text-sm text-ink">{t("diaper_stock_title")}</Text>
        </View>
        <Text className="mb-3 mt-1 font-body text-xs leading-5 text-ink-soft">{t("diaper_stock_hint")}</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={value}
            onChangeText={(v) => setValue(v.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            placeholder={t("diaper_stock_set")}
            placeholderClassName="text-ink-faint"
            onSubmitEditing={save}
            className="flex-1 rounded-xl border border-cream-line bg-cream px-3.5 py-2.5 font-body text-sm text-ink"
          />
          <Pressable onPress={save} accessibilityRole="button" className="rounded-full bg-ink px-5 py-2.5">
            <Text className="font-bodySemibold text-sm text-cream">{t("save_action")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const left = estimate!.left;
  const days = estimate!.daysLeft;
  const low = estimate!.low;

  return (
    <View style={[shadows.soft, low ? { borderWidth: 1, borderColor: "#E9B97A" } : null]} className={`mb-5 rounded-xl2 p-4 ${low ? "bg-[#FBEFDD]" : "bg-surface"}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon name="diaper" size={16} color={low ? "#B8641A" : "#6E7452"} />
          <Text className={`font-bodySemibold text-sm ${low ? "text-[#8A4A12]" : "text-ink"}`}>{low ? t("diaper_stock_low") : t("diaper_stock_title")}</Text>
        </View>
        <Pressable onPress={() => { setValue(String(left)); setEditing(true); }} hitSlop={8} accessibilityRole="button">
          <Text className="font-bodyMedium text-xs text-olive">{t("diaper_stock_edit")}</Text>
        </Pressable>
      </View>

      <Text className={`mt-1.5 font-display text-2xl ${low ? "text-[#8A4A12]" : "text-ink"}`}>{t("diaper_stock_left", { n: left })}</Text>
      {days !== null ? (
        <Text className="font-body text-xs text-ink-soft">{t("diaper_stock_days", { d: days < 1 ? "<1" : Math.round(days) })}</Text>
      ) : null}

      {low ? (
        <Pressable onPress={order} accessibilityRole="button" className="mt-3 items-center rounded-full bg-ink px-5 py-3">
          <Text className="font-bodySemibold text-sm text-cream" numberOfLines={1}>
            {lastItem ? t("diaper_stock_reorder", { name: lastItem.name }) : t("diaper_stock_find")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
