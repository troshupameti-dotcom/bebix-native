import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { fetchAllOrders } from "@/lib/shop/reorder";
import type { SupplyEstimate, SupplyStock } from "@/lib/baby/supply";
import type { MyOrder, OrderItem } from "@/lib/shop/orders";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Çka ndryshon mes pelenave dhe formulës: ruajtja, pragu, produkti në dyqan dhe tekstet. */
export type SupplyConfig = {
  icon: IconName;
  load: () => Promise<SupplyStock | null>;
  save: (remaining: number) => Promise<SupplyStock>;
  estimate: (stock: SupplyStock, entries: { at: string }[]) => SupplyEstimate;
  /** Produkti që klienti e ka blerë herën e fundit te dyqani. */
  lastItem: (orders: MyOrder[]) => OrderItem | null;
  /** Kërkimi te dyqani kur s'ka blerë ende. */
  searchQuery: string;
  text: {
    title: TranslationKey;
    hint: TranslationKey;
    set: TranslationKey;
    left: TranslationKey;
    days: TranslationKey;
    low: TranslationKey;
    reorder: TranslationKey;
    find: TranslationKey;
    /** Rreshti i vogël kur s'ka numër ende (vetëm me `compactUntilSet`). */
    compact?: TranslationKey;
  };
};

/**
 * "Sa të mbeten": prindi vendos sa ka, TROA i numëron vetë nga ditari dhe, para se të mbarojnë, ofron porosinë me
 * një prekje (i njëjti produkt që ka blerë herën e fundit, ose kërkimi te dyqani kur s'ka blerë ende).
 * `compactUntilSet`: pa numër të vendosur, vetëm një rresht i vogël që hapet me prekje (p.sh. formula për bebet që
 * s'e kanë pirë ende): mbetet e dukshme, por s'zë vend te nënat që ushqejnë me gji.
 */
export function SupplyCard({ entries, config, compactUntilSet = false }: { entries: { at: string }[]; config: SupplyConfig; compactUntilSet?: boolean }) {
  // Paralajmërimi "po mbarojnë" me tonin qelibar sipas temës.
  const tones = useTones();
  const { t } = useTranslation();
  const router = useRouter();
  const { addToCart } = useAppState();
  const [stock, setStock] = useState<SupplyStock | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [lastItem, setLastItem] = useState<OrderItem | null>(null);
  const { load, estimate: estimateOf, lastItem: findLast, text } = config;

  useEffect(() => {
    let alive = true;
    void load().then((s) => {
      if (!alive) return;
      setStock(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const estimate = useMemo(() => (stock ? estimateOf(stock, entries) : null), [stock, entries, estimateOf]);

  // Produkti i blerë herën e fundit kërkohet vetëm kur duhet porositur.
  useEffect(() => {
    if (!estimate?.low) return;
    let alive = true;
    void fetchAllOrders().then((orders) => {
      if (alive) setLastItem(findLast(orders));
    });
    return () => {
      alive = false;
    };
  }, [estimate?.low, findLast]);

  async function save() {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setStock(await config.save(n));
    setEditing(false);
    setValue("");
    haptics.success();
  }

  function order() {
    haptics.select();
    if (lastItem) {
      addToCart({ id: lastItem.id, name: lastItem.name, price: lastItem.price, imageUrl: lastItem.imageUrl ?? null, icon: lastItem.icon ?? "cube" }, lastItem.qty);
      // Një prekje: drejt te përfundimi i porosisë, jo te shporta.
      router.push("/shop/checkout", { withAnchor: true });
    } else {
      router.push({ pathname: "/(main)/shop", params: { q: config.searchQuery } });
    }
  }

  if (!loaded) return null;

  if (!stock && !editing && compactUntilSet) {
    return (
      <Pressable
        onPress={() => {
          haptics.tap();
          setEditing(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t(text.title)}. ${t(text.compact ?? text.set)}`}
        style={shadows.soft}
        className="mb-5 flex-row items-center gap-3 rounded-xl2 bg-surface px-4 py-3 active:opacity-80"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-cream-soft">
          <Icon name={config.icon} size={16} color="#6E7452" />
        </View>
        <View className="flex-1">
          <Text className="font-bodySemibold text-sm text-ink">{t(text.title)}</Text>
          <Text className="font-body text-xs leading-[17px] text-ink-soft">{t(text.compact ?? text.set)}</Text>
        </View>
        <Icon name="chevronRight" size={16} color="#8A8170" />
      </Pressable>
    );
  }

  // Pa numër ose gjatë ndryshimit: pyetja e vetme.
  if (!stock || editing) {
    return (
      <View style={shadows.soft} className="mb-5 rounded-xl2 bg-surface p-4">
        <View className="flex-row items-center gap-2">
          <Icon name={config.icon} size={16} color="#6E7452" />
          <Text className="flex-1 font-bodySemibold text-sm text-ink">{t(text.title)}</Text>
          {editing ? (
            <Pressable
              onPress={() => {
                setEditing(false);
                setValue("");
              }}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text className="font-bodyMedium text-xs text-ink-soft">{t("cancel")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mb-3 mt-1 font-body text-xs leading-5 text-ink-soft">{t(text.hint)}</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={value}
            onChangeText={(v) => setValue(v.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            placeholder={t(text.set)}
            accessibilityLabel={t(text.set)}
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
    <View style={[shadows.soft, low ? { borderWidth: 1, borderColor: tones.amber.tint, backgroundColor: tones.amber.tintBg } : null]} className={`mb-5 rounded-xl2 p-4 ${low ? "" : "bg-surface"}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon name={config.icon} size={16} color={low ? "#B8641A" : "#6E7452"} />
          <Text className={`font-bodySemibold text-sm ${low ? "" : "text-ink"}`} style={low ? { color: tones.amber.tint } : undefined}>
            {low ? t(text.low) : t(text.title)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setValue(String(left));
            setEditing(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text className="font-bodyMedium text-xs text-olive">{t("diaper_stock_edit")}</Text>
        </Pressable>
      </View>

      <Text className={`mt-1.5 font-display text-2xl ${low ? "" : "text-ink"}`} style={low ? { color: tones.amber.tint } : undefined}>
        {t(text.left, { n: left })}
      </Text>
      {days !== null ? <Text className="font-body text-xs text-ink-soft">{t(text.days, { d: days < 1 ? "<1" : Math.round(days) })}</Text> : null}

      {low ? (
        <Pressable onPress={order} accessibilityRole="button" className="mt-3 items-center rounded-full bg-ink px-5 py-3">
          <Text className="font-bodySemibold text-sm text-cream" numberOfLines={1}>
            {lastItem ? t(text.reorder, { name: lastItem.name }) : t(text.find)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
