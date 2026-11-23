import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { BAG_ITEMS, bagProgress, loadBag, saveBag, toggleBagItem, type BagGroup } from "@/lib/parent/pregnancyTools";

const GROUPS: { id: BagGroup; label: TranslationKey }[] = [
  { id: "docs", label: "bag_group_docs" },
  { id: "mom", label: "bag_group_mom" },
  { id: "baby", label: "bag_group_baby" },
];

/** Çanta e maternitetit: një listë e thjeshtë me shenja, e ruajtur te telefoni. */
export default function HospitalBagScreen() {
  const tones = useTones();
  const { t } = useTranslation();
  const [checked, setChecked] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadBag().then((l) => alive && setChecked(l));
    return () => {
      alive = false;
    };
  }, []);

  function toggle(id: string) {
    if (!checked) return;
    const next = toggleBagItem(checked, id);
    if (bagProgress(next).done === BAG_ITEMS.length) haptics.success();
    else haptics.select();
    setChecked(next);
    void saveBag(next);
  }

  const { done, total } = bagProgress(checked ?? []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("preg_bag_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="font-body text-[14px] leading-5 text-ink-soft">{t("bag_intro")}</Text>

        <View style={[shadows.soft, { backgroundColor: tones.green.tintBg }]} className="mt-4 rounded-2xl p-4">
          <Text className="font-bodySemibold text-[15px]" style={{ color: tones.green.tint }}>
            {done === total ? t("bag_done") : t("preg_bag_hint", { done, total })}
          </Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tones.green.chip }}>
            <View style={{ width: `${(done / total) * 100}%`, backgroundColor: tones.green.tint }} className="h-2 rounded-full" />
          </View>
        </View>

        {GROUPS.map((g) => (
          <View key={g.id} className="mt-5">
            <Text className="mb-1 font-bodySemibold text-[15px] text-ink">{t(g.label)}</Text>
            {BAG_ITEMS.filter((i) => i.group === g.id).map((item) => {
              const on = checked?.includes(item.id) ?? false;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={shadows.soft}
                  className="mt-2 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3"
                >
                  <View
                    className="h-6 w-6 items-center justify-center rounded-md"
                    style={{ backgroundColor: on ? tones.green.tint : "transparent", borderWidth: on ? 0 : 1.5, borderColor: tones.inkSoft }}
                  >
                    {on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text className="flex-1 font-body text-[14.5px]" style={{ color: on ? tones.inkSoft : tones.ink }}>
                    {t(`bag_item_${item.id}` as TranslationKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(main)/shop");
          }}
          accessibilityRole="link"
          style={shadows.soft}
          className="mt-6 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
        >
          <View style={{ backgroundColor: tones.blue.tintBg }} className="h-10 w-10 items-center justify-center rounded-xl">
            <Icon name="shop" size={20} color={tones.blue.tint} />
          </View>
          <Text className="flex-1 font-bodySemibold text-[14.5px] text-ink">{t("bag_shop")}</Text>
          <Icon name="chevronRight" size={18} color={tones.inkSoft} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
