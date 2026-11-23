import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useTones } from "@/lib/theme/tone";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  BAG_ITEMS, BAG_PHASES, EMPTY_BAG, MAX_CUSTOM_LABEL, addCustomItem, bagProgress, loadBag, removeCustomItem, saveBag, toggleBagItem,
  type BagGroup, type BagPhase, type BagState,
} from "@/lib/parent/pregnancyTools";

const GROUPS: { id: BagGroup; label: TranslationKey }[] = [
  { id: "docs", label: "bag_group_docs" },
  { id: "mom", label: "bag_group_mom" },
  { id: "baby", label: "bag_group_baby" },
];

const INTRO: Record<BagPhase, TranslationKey> = { before: "bag_intro_before", hospital: "bag_intro", after: "bag_intro_after" };

/**
 * Lista e përgatitjes: tri faza (para lindjes, materniteti, pas lindjes). Në secilën, sugjerimet e TROA-s dhe sendet
 * që prindi i shkruan vetë. Gjithçka rri te telefoni.
 */
export default function HospitalBagScreen() {
  const tones = useTones();
  const theme = useThemeColors();
  const { t } = useTranslation();
  const [bag, setBag] = useState<BagState | null>(null);
  const [phase, setPhase] = useState<BagPhase>("hospital");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let alive = true;
    void loadBag().then((s) => alive && setBag(s));
    return () => {
      alive = false;
    };
  }, []);

  function update(next: BagState) {
    setBag(next);
    void saveBag(next);
  }

  function toggle(id: string) {
    if (!bag) return;
    const next = toggleBagItem(bag, id);
    const p = bagProgress(next, phase);
    if (p.done === p.total) haptics.success();
    else haptics.select();
    update(next);
  }

  function addOwn() {
    if (!bag) return;
    const next = addCustomItem(bag, draft, phase);
    if (next === bag) return;
    haptics.success();
    setDraft("");
    update(next);
  }

  const state = bag ?? EMPTY_BAG;
  const { done, total } = bagProgress(state, phase);
  const suggested = BAG_ITEMS.filter((i) => i.phase === phase);
  const own = state.custom.filter((c) => c.phase === phase);

  const row = (id: string, label: string, extra?: ReactNode) => {
    const on = state.checked.includes(id);
    return (
      <View key={id} style={shadows.soft} className="mt-2 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
        <Pressable
          onPress={() => toggle(id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          accessibilityLabel={label}
          hitSlop={6}
          className="flex-1 flex-row items-center gap-3"
        >
          <View
            className="h-6 w-6 items-center justify-center rounded-md"
            style={{ backgroundColor: on ? tones.green.tint : "transparent", borderWidth: on ? 0 : 1.5, borderColor: tones.inkSoft }}
          >
            {on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <Text className="flex-1 font-body text-[14.5px]" style={{ color: on ? tones.inkSoft : tones.ink }}>
            {label}
          </Text>
        </Pressable>
        {extra}
      </View>
    );
  };

  const shopLink = (q: string) => (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push({ pathname: "/(main)/shop", params: { q } });
      }}
      accessibilityRole="link"
      hitSlop={8}
      className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: tones.blue.tintBg }}
    >
      <Icon name="shop" size={13} color={tones.blue.tint} />
      <Text className="font-bodySemibold text-[12px]" style={{ color: tones.blue.tint }}>
        {t("bag_shop_item")}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("preg_bag_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row rounded-2xl bg-cream-soft p-1" accessibilityRole="tablist">
          {BAG_PHASES.map((p) => {
            const selected = p === phase;
            const pp = bagProgress(state, p);
            return (
              <Pressable
                key={p}
                onPress={() => {
                  haptics.select();
                  setPhase(p);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-xl py-2 ${selected ? "bg-surface" : ""}`}
              >
                <Text className={`font-bodySemibold text-[13px] ${selected ? "text-ink" : "text-ink-faint"}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t(`bag_phase_${p}` as TranslationKey)}
                </Text>
                <Text className="font-body text-[11.5px] text-ink-soft">{`${pp.done}/${pp.total}`}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-4 font-body text-[14px] leading-5 text-ink-soft">{t(INTRO[phase])}</Text>

        <View style={[shadows.soft, { backgroundColor: tones.green.tintBg }]} className="mt-4 rounded-2xl p-4">
          <Text className="font-bodySemibold text-[15px]" style={{ color: tones.green.tint }}>
            {total > 0 && done === total ? t("bag_phase_done") : t("preg_bag_hint", { done, total })}
          </Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tones.green.chip }}>
            <View style={{ width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: tones.green.tint }} className="h-2 rounded-full" />
          </View>
        </View>

        <Text className="mt-5 font-bodySemibold text-[15px] text-ink">{t("bag_suggested")}</Text>
        {phase === "hospital"
          ? GROUPS.map((g) => (
              <View key={g.id} className="mt-3">
                <Text className="font-bodyMedium text-[13px] text-ink-soft">{t(g.label)}</Text>
                {suggested.filter((i) => i.group === g.id).map((item) => row(item.id, t(`bag_item_${item.id}` as TranslationKey)))}
              </View>
            ))
          : suggested.map((item) => row(item.id, t(`bag_item_${item.id}` as TranslationKey), item.shopQuery ? shopLink(item.shopQuery) : null))}

        <Text className="mt-6 font-bodySemibold text-[15px] text-ink">{t("bag_yours")}</Text>
        {own.map((c) =>
          row(
            c.id,
            c.label,
            <Pressable
              onPress={() => {
                haptics.select();
                update(removeCustomItem(state, c.id));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t("bag_remove")}: ${c.label}`}
              hitSlop={10}
            >
              <Icon name="close" size={16} color={tones.inkSoft} />
            </Pressable>,
          ),
        )}
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t("bag_add_ph")}
            placeholderTextColor={theme.inkFaint}
            maxLength={MAX_CUSTOM_LABEL}
            returnKeyType="done"
            onSubmitEditing={addOwn}
            accessibilityLabel={t("bag_add_ph")}
            className="flex-1 rounded-2xl border border-ink/10 bg-surface px-4 font-body text-[14.5px] text-ink"
            style={{ minHeight: 48 }}
          />
          <Pressable
            onPress={addOwn}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityState={{ disabled: !draft.trim() }}
            className="flex-row items-center gap-1.5 rounded-2xl bg-olive px-4"
            style={{ minHeight: 48, opacity: draft.trim() ? 1 : 0.5 }}
          >
            <Icon name="plus" size={16} color="#FFFFFF" />
            <Text className="font-bodySemibold text-[14.5px] text-on-accent">{t("bag_add")}</Text>
          </Pressable>
        </View>

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
