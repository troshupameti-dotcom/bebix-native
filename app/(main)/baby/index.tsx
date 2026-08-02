import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput, Alert, Share } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/baby/SectionHeader";
import { StatCard } from "@/components/baby/StatCard";
import { AddTile } from "@/components/baby/AddTile";
import { QuickActionTile } from "@/components/baby/QuickActionTile";
import { InfoRow } from "@/components/baby/InfoRow";
import { MilestoneChip } from "@/components/baby/MilestoneChip";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PickerSheetContent, PickerOption } from "@/components/baby/PickerSheetContent";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { computeAgeText, formatDate, formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { QuickActionKey } from "@/lib/state/types";

const TABS = ["profile", "timeline", "health", "milestones"] as const;
type TabKey = (typeof TABS)[number];

const QA_META: Record<QuickActionKey, { icon: IconName; labelKey: string; accent: "olive" | "orange" }> = {
  feeding: { icon: "spoon", labelKey: "tile_feeding", accent: "orange" },
  sleep: { icon: "moon", labelKey: "tile_sleep", accent: "olive" },
  diaper: { icon: "baby", labelKey: "diaper_title", accent: "orange" },
  growth: { icon: "chart", labelKey: "tile_growth", accent: "olive" },
  vaccinations: { icon: "syringe", labelKey: "qa_vaccinations", accent: "olive" },
  medical: { icon: "shield", labelKey: "medical_screen_title", accent: "olive" },
  moments: { icon: "sparkle", labelKey: "moments_screen_title", accent: "orange" },
  bath: { icon: "bath", labelKey: "qa_bath", accent: "olive" },
  medicine: { icon: "pill", labelKey: "qa_medicine", accent: "orange" },
  play: { icon: "play", labelKey: "qa_play", accent: "orange" },
};

type SheetContext = "growth" | "quickActions" | "medical" | "timeline" | null;
type FeedKind = "event" | "feeding" | "sleep" | "diaper" | "growth" | "vaccine" | "medical";
type FeedEntry = {
  id: string;
  kind: FeedKind;
  title: string;
  subtitle: string;
  sortTime: number;
  icon: IconName;
  tint: "olive" | "orange";
};

const RANGE_KEYS = ["day", "week", "month"] as const;

export default function BabyProfileScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const { profile } = state;
  const b = state.baby;

  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [editGrowth, setEditGrowth] = useState(false);
  const [editQuickActions, setEditQuickActions] = useState(false);
  const [editMedical, setEditMedical] = useState(false);
  const [editMilestones, setEditMilestones] = useState(false);
  const [sheet, setSheet] = useState<SheetContext>(null);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<FeedKind | "all">("all");
  const [rangeView, setRangeView] = useState<(typeof RANGE_KEYS)[number]>("week");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function selectionKey(kind: FeedKind, id: string) {
    return `${kind}-${id}`;
  }
  function toggleSelect(kind: FeedKind, id: string) {
    haptics.select();
    const key = selectionKey(kind, id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function kindToRecordKind(k: FeedKind): "growthHistory" | "feeding" | "sleep" | "diaper" | "vaccine" | "moment" | "medical" | "timeline" {
    if (k === "event") return "timeline";
    if (k === "growth") return "growthHistory";
    return k;
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }
  function selectedRecordRefs() {
    return Array.from(selectedIds).map((key: string) => {
      const [kind, ...rest] = key.split("-");
      return { kind: kindToRecordKind(kind as FeedKind), id: rest.join("-") };
    });
  }
  function bulkDeleteSelected() {
    const refs = selectedRecordRefs();
    Alert.alert(t("bulk_delete_confirm_title"), t("bulk_delete_confirm_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("delete_action"),
        style: "destructive",
        onPress: () => {
          haptics.warning();
          baby.bulkDelete(refs);
          showToast(t("deleted_toast"), () => baby.bulkRestore(refs));
          exitSelectMode();
        },
      },
    ]);
  }
  function bulkArchiveSelected() {
    haptics.tap();
    baby.bulkArchive(selectedRecordRefs());
    exitSelectMode();
  }
  function bulkShareSelected() {
    haptics.tap();
    const items = filteredFeed.filter((f) => selectedIds.has(selectionKey(f.kind, f.id)));
    const text = items.map((i) => `${i.title} — ${i.subtitle}`).join("\n");
    Share.share({ message: text || t("timeline_empty") });
  }
  function bulkExportSelected() {
    haptics.tap();
    const items = filteredFeed.filter((f) => selectedIds.has(selectionKey(f.kind, f.id)));
    const csv = ["Kind,Title,Details", ...items.map((i) => `${i.kind},"${i.title}","${i.subtitle}"`)].join("\n");
    Share.share({ message: csv });
  }

  const babyName = profile.nickname || profile.babyName || "Elira";
  const ageText = profile.babyDob ? computeAgeText(profile.babyDob, lang) : "";
  const upcomingVaccineCount = active(b.vaccines).filter((v) => !v.givenDate).length;

  function runQuickAction(key: QuickActionKey) {
    haptics.tap();
    if (key === "feeding") router.push("/(main)/baby/feeding");
    else if (key === "sleep") router.push("/(main)/baby/sleep");
    else if (key === "diaper") router.push("/(main)/baby/diaper");
    else if (key === "growth") router.push("/(main)/baby/growth");
    else if (key === "vaccinations") router.push("/(main)/baby/vaccinations");
    else if (key === "medical") router.push("/(main)/baby/medical");
    else if (key === "moments") router.push("/(main)/baby/moments");
    else setActiveTab("health");
  }

  function closeSheet() {
    setSheet(null);
  }

  function toggleEdit(setter: (v: (p: boolean) => boolean) => void) {
    haptics.select();
    setter((v) => !v);
  }

  // ---- Unified timeline feed ----
  const feed = useMemo<FeedEntry[]>(() => {
    const items: FeedEntry[] = [];
    active(b.timeline).forEach((ev) => {
      const ms = new Date(ev.date).getTime();
      items.push({
        id: ev.id,
        kind: "event",
        title: ev.title,
        subtitle: isNaN(ms) ? ev.date : formatDate(ev.date, lang),
        sortTime: isNaN(ms) ? Date.now() : ms,
        icon: "sparkle",
        tint: ev.color,
      });
    });
    active(b.feedingLog).forEach((f) =>
      items.push({
        id: f.id,
        kind: "feeding",
        title: t(`feeding_type_${f.type === "medicine" ? "medicine_short" : f.type}` as never),
        subtitle: `${formatDate(f.at, lang)} · ${formatTime(f.at, lang)}`,
        sortTime: new Date(f.at).getTime(),
        icon: "spoon",
        tint: "orange",
      })
    );
    active(b.sleepLog).forEach((s) =>
      items.push({
        id: s.id,
        kind: "sleep",
        title: t("sleep_screen_title"),
        subtitle: `${formatDate(s.startAt, lang)} · ${formatTime(s.startAt, lang)}`,
        sortTime: new Date(s.startAt).getTime(),
        icon: "moon",
        tint: "olive",
      })
    );
    active(b.diaperLog).forEach((d) =>
      items.push({
        id: d.id,
        kind: "diaper",
        title: t(`diaper_type_${d.type}` as never),
        subtitle: `${formatDate(d.at, lang)} · ${formatTime(d.at, lang)}`,
        sortTime: new Date(d.at).getTime(),
        icon: "baby",
        tint: "orange",
      })
    );
    active(b.growthHistory).forEach((g) =>
      items.push({
        id: g.id,
        kind: "growth",
        title: t("growth_screen_title"),
        subtitle: `${g.weightKg ? g.weightKg + " kg " : ""}${g.heightCm ? g.heightCm + " cm" : ""} · ${formatDate(g.date, lang)}`,
        sortTime: new Date(g.date).getTime(),
        icon: "chart",
        tint: "olive",
      })
    );
    active(b.vaccines)
      .filter((v) => v.givenDate)
      .forEach((v) =>
        items.push({
          id: v.id,
          kind: "vaccine",
          title: v.name,
          subtitle: formatDate(v.givenDate!, lang),
          sortTime: new Date(v.givenDate!).getTime(),
          icon: "syringe",
          tint: "olive",
        })
      );
    active(b.medicalRecords).forEach((m) =>
      items.push({
        id: m.id,
        kind: "medical",
        title: m.title,
        subtitle: `${t(`medical_type_${m.type}` as never)} · ${formatDate(m.at, lang)}`,
        sortTime: new Date(m.at).getTime(),
        icon: "shield",
        tint: "olive",
      })
    );
    return items.sort((a, b2) => b2.sortTime - a.sortTime);
  }, [b, lang, t]);

  const rangeStart = useMemo(() => {
    const now = Date.now();
    if (rangeView === "day") return now - 86400000;
    if (rangeView === "week") return now - 7 * 86400000;
    return now - 30 * 86400000;
  }, [rangeView]);

  const filteredFeed = feed.filter((item) => {
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (item.sortTime < rangeStart) return false;
    if (search.trim() && !item.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="font-display text-2xl text-ink">{babyName}</Text>
        <View className="flex-row gap-2">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-white" style={shadows.press}>
            <Icon name="share" size={16} color="#2C271F" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(main)/baby/settings")}
            className="h-9 w-9 items-center justify-center rounded-full bg-white"
            style={shadows.press}
          >
            <Icon name="edit" size={16} color="#2C271F" />
          </Pressable>
        </View>
      </View>

      {/* Segmented tab control */}
      <View className="mx-5 mb-2 flex-row rounded-2xl bg-cream-soft p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                haptics.select();
                setActiveTab(tab);
              }}
              className="flex-1 py-2.5"
            >
              {isActive && (
                <MotiView
                  from={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "timing", duration: 180 }}
                  style={[shadows.press, { position: "absolute", inset: 2, borderRadius: 14, backgroundColor: "#fff" }]}
                />
              )}
              <Text className={`text-center font-bodySemibold text-[12.5px] ${isActive ? "text-ink" : "text-ink-faint"}`}>
                {t(`baby_tab_${tab}` as never)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {activeTab === "profile" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            {/* Baby card */}
            <View style={shadows.soft} className="mt-2 flex-row items-center gap-4 rounded-xl3 border border-ink/10 bg-white p-4">
              {profile.babyPhoto ? (
                <Image source={{ uri: profile.babyPhoto }} className="h-16 w-16 rounded-full" />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-cream-soft">
                  <Icon name="baby" size={26} color="#A79D8A" />
                </View>
              )}
              <View className="flex-1">
                <Text className="font-display text-base text-ink">{babyName}</Text>
                {profile.babyDob && (
                  <Text className="mt-0.5 font-body text-xs text-ink-soft">
                    {t("baby_born")} {formatDate(profile.babyDob, lang)}
                  </Text>
                )}
                {ageText ? <Text className="mt-0.5 font-body text-xs text-ink-soft">{ageText}</Text> : null}
              </View>
            </View>

            {/* Growth summary */}
            <SectionHeader title={t("baby_growth_summary")} editable editing={editGrowth} onToggleEdit={() => toggleEdit(setEditGrowth)} />
            <View className="flex-row flex-wrap gap-3">
              {b.growthStats.map((g) => (
                <View key={g.key} style={{ width: "47.5%" }}>
                  <StatCard
                    label={g.isCustom ? g.label ?? "" : t(g.labelKey as never)}
                    value={g.value}
                    sub={g.isCustom ? undefined : g.subKey ? t(g.subKey as never) : undefined}
                    editing={editGrowth}
                    isCustom={g.isCustom}
                    onChangeValue={(v) => baby.updateGrowthStat(g.key, { value: v })}
                    onChangeLabel={(v) => baby.updateGrowthStat(g.key, { label: v })}
                    onRemove={() => baby.removeGrowthStat(g.key)}
                  />
                </View>
              ))}
              {editGrowth && (
                <View style={{ width: "47.5%" }}>
                  <AddTile onPress={() => setSheet("growth")} />
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/(main)/baby/growth")} className="mt-3 items-center rounded-2xl bg-ink py-3.5">
              <Text className="font-bodySemibold text-[14px] text-cream">{t("baby_see_chart")}</Text>
            </Pressable>

            {/* Quick actions */}
            <SectionHeader title={t("baby_quick_actions")} editable editing={editQuickActions} onToggleEdit={() => toggleEdit(setEditQuickActions)} />
            <View className="flex-row flex-wrap gap-2.5">
              {b.quickActionKeys.map((key) => {
                const meta = QA_META[key];
                return (
                  <View key={key} style={{ width: "22.5%" }}>
                    <QuickActionTile
                      icon={meta.icon}
                      label={t(meta.labelKey as never)}
                      accent={meta.accent}
                      editing={editQuickActions}
                      onPress={() => runQuickAction(key)}
                      onRemove={() => baby.removeQuickAction(key)}
                    />
                  </View>
                );
              })}
              {editQuickActions && (
                <View style={{ width: "22.5%" }}>
                  <AddTile onPress={() => setSheet("quickActions")} />
                </View>
              )}
            </View>
          </MotiView>
        )}

        {activeTab === "timeline" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            <View className="mt-2 flex-row items-center gap-2">
              <View className="flex-1 flex-row items-center gap-2 rounded-2xl bg-white border border-ink/10 px-3.5 py-2.5">
                <Icon name="search" size={15} color="#A79D8A" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("timeline_search_ph")}
                  placeholderTextColor="#A79D8A"
                  className="flex-1 font-body text-[13.5px] text-ink"
                />
              </View>
              <Pressable
                onPress={() => {
                  haptics.select();
                  if (selectMode) exitSelectMode();
                  else setSelectMode(true);
                }}
                className={`rounded-2xl px-3.5 py-3 ${selectMode ? "bg-ink" : "bg-white border border-ink/10"}`}
              >
                <Text className={`font-bodyMedium text-[12.5px] ${selectMode ? "text-cream" : "text-ink"}`}>
                  {selectMode ? t("bulk_cancel") : t("bulk_select_action")}
                </Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
              {(["all", "feeding", "sleep", "diaper", "growth", "vaccine", "medical"] as const).map((k) => {
                const isActive = kindFilter === k;
                const labelKey = k === "all" ? "timeline_filter_all" : k === "feeding" ? "tile_feeding" : k === "sleep" ? "tile_sleep" : k === "diaper" ? "diaper_title" : k === "growth" ? "tile_growth" : k === "vaccine" ? "qa_vaccinations" : "medical_screen_title";
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      haptics.select();
                      setKindFilter(k);
                    }}
                    className={`rounded-full border px-3.5 py-2 ${isActive ? "border-ink bg-ink" : "border-ink/10 bg-white"}`}
                  >
                    <Text className={`font-bodyMedium text-[12px] ${isActive ? "text-cream" : "text-ink"}`}>{t(labelKey as never)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-3 flex-row rounded-2xl bg-cream-soft p-1">
              {RANGE_KEYS.map((r) => {
                const isActive = rangeView === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => {
                      haptics.select();
                      setRangeView(r);
                    }}
                    className="flex-1 items-center rounded-xl py-2"
                    style={isActive ? [shadows.press, { backgroundColor: "#fff" }] : undefined}
                  >
                    <Text className={`font-bodySemibold text-[11.5px] ${isActive ? "text-ink" : "text-ink-faint"}`}>
                      {t(`timeline_view_${r}` as never)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-4">
              {filteredFeed.length === 0 ? (
                <View className="items-center gap-2 py-14">
                  <Icon name="sparkle" size={24} color="#E9DFCC" />
                  <Text className="font-body text-sm text-ink-soft">{t("timeline_empty")}</Text>
                </View>
              ) : (
                filteredFeed.map((item, i) => {
                  const key = selectionKey(item.kind, item.id);
                  const isSelected = selectedIds.has(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => (selectMode ? toggleSelect(item.kind, item.id) : undefined)}
                      className="flex-row gap-3"
                    >
                      <View className="items-center">
                        {selectMode ? (
                          <View
                            className={`mt-0.5 h-4 w-4 items-center justify-center rounded-full border ${isSelected ? "border-ink bg-ink" : "border-ink/25 bg-white"}`}
                          >
                            {isSelected && <Icon name="check" size={9} color="#FBF6EE" />}
                          </View>
                        ) : (
                          <View
                            style={{ backgroundColor: item.tint === "orange" ? "#C9702E" : "#6E7452" }}
                            className="mt-1.5 h-2.5 w-2.5 rounded-full"
                          />
                        )}
                        {i < filteredFeed.length - 1 && <View className="w-px flex-1 bg-ink/10" />}
                      </View>
                      <View className="flex-1 flex-row items-center justify-between pb-5">
                        <View>
                          <Text className="font-bodySemibold text-[14px] text-ink">{item.title}</Text>
                          <Text className="font-body text-xs text-ink-soft">{item.subtitle}</Text>
                        </View>
                        {!selectMode && item.kind === "event" && (
                          <Pressable
                            onPress={() => {
                              haptics.warning();
                              baby.deleteTimelineEvent(item.id);
                              showToast(t("deleted_toast"), () => baby.restoreTimelineEvent(item.id));
                            }}
                            hitSlop={8}
                          >
                            <Icon name="close" size={14} color="#A79D8A" />
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {selectMode && selectedIds.size > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 180 }}
                style={shadows.softLg}
                className="mt-2 flex-row items-center justify-between rounded-2xl bg-ink px-4 py-3"
              >
                <Text className="font-bodySemibold text-[12.5px] text-cream">
                  {selectedIds.size} {t("bulk_selected_count")}
                </Text>
                <View className="flex-row gap-4">
                  <Pressable onPress={bulkArchiveSelected} hitSlop={6}>
                    <Icon name="download" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable onPress={bulkExportSelected} hitSlop={6}>
                    <Icon name="chart" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable onPress={bulkShareSelected} hitSlop={6}>
                    <Icon name="share" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable onPress={bulkDeleteSelected} hitSlop={6}>
                    <Icon name="close" size={17} color="#F87171" />
                  </Pressable>
                </View>
              </MotiView>
            )}

            <Pressable onPress={() => setSheet("timeline")} className="mt-1 flex-row items-center gap-2 py-2">
              <Icon name="plus" size={14} color="#6E7452" />
              <Text className="font-bodyMedium text-[13.5px] text-olive">{t("add_action")}</Text>
            </Pressable>
          </MotiView>
        )}

        {activeTab === "health" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            <Pressable
              onPress={() => router.push("/(main)/baby/vaccinations")}
              style={shadows.soft}
              className="mt-2 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-olive-bg">
                <Icon name="syringe" size={18} color="#6E7452" />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-[14px] text-ink">{t("vaccine_screen_title")}</Text>
                <Text className="font-body text-xs text-ink-soft">
                  {upcomingVaccineCount} {t("vaccine_status_upcoming").toLowerCase()}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color="#A79D8A" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(main)/baby/medical")}
              style={shadows.soft}
              className="mt-3 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-bg">
                <Icon name="shield" size={18} color="#C9702E" />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-[14px] text-ink">{t("medical_screen_title")}</Text>
                <Text className="font-body text-xs text-ink-soft">{active(b.medicalRecords).length}</Text>
              </View>
              <Icon name="chevronRight" size={16} color="#A79D8A" />
            </Pressable>

            <SectionHeader title={t("baby_medical_info")} editable editing={editMedical} onToggleEdit={() => toggleEdit(setEditMedical)} />
            <View style={shadows.soft} className="rounded-xl2 border border-ink/10 bg-white px-4">
              {b.medicalInfo
                .filter((m) => b.medicalActiveKeys.includes(m.key))
                .map((m) => (
                  <InfoRow
                    key={m.key}
                    label={m.isCustom ? m.label ?? "" : t(m.labelKey as never)}
                    value={m.value}
                    isCustom={m.isCustom}
                    editing={editMedical}
                    placeholder={t("value_field")}
                    onChangeValue={(v) => baby.updateMedicalRow(m.key, { value: v })}
                    onChangeLabel={(v) => baby.updateMedicalRow(m.key, { label: v })}
                    onRemove={() => baby.removeMedicalRow(m.key)}
                  />
                ))}
            </View>
            {editMedical && (
              <Pressable onPress={() => setSheet("medical")} className="mt-3 flex-row items-center gap-2 py-1">
                <Icon name="plus" size={14} color="#6E7452" />
                <Text className="font-bodyMedium text-[13.5px] text-olive">{t("add_action")}</Text>
              </Pressable>
            )}
          </MotiView>
        )}

        {activeTab === "milestones" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            <SectionHeader title={t("baby_tab_milestones")} editable editing={editMilestones} onToggleEdit={() => toggleEdit(setEditMilestones)} />
            <View className="flex-row flex-wrap gap-2.5">
              {b.milestones
                .filter((m) => b.milestoneActiveKeys.includes(m.key))
                .map((m) => (
                  <MilestoneChip
                    key={m.key}
                    label={m.isCustom ? m.label ?? "" : t(m.labelKey as never)}
                    done={m.done}
                    isCustom={m.isCustom}
                    editing={editMilestones}
                    onToggle={() => {
                      haptics.success();
                      baby.toggleMilestone(m.key);
                    }}
                    onChangeLabel={(v) => baby.updateMilestoneLabel(m.key, v)}
                    onRemove={() => baby.removeMilestone(m.key)}
                  />
                ))}
              {editMilestones && (
                <Pressable
                  onPress={() => setSheet("timeline")}
                  style={{ width: "48%" }}
                  className="items-center justify-center rounded-2xl border border-dashed border-cream-line py-3.5"
                >
                  <Icon name="plus" size={18} color="#A79D8A" />
                </Pressable>
              )}
            </View>
          </MotiView>
        )}
      </ScrollView>

      {/* ---- Sheets ---- */}
      <BottomSheet visible={sheet === "growth"} onClose={closeSheet}>
        <PickerSheetContent
          title={t("baby_growth_summary")}
          options={baby.availableGrowthPresets().map<PickerOption>((g) => ({ key: g.key, label: t(g.labelKey as never) }))}
          onSelect={(key) => {
            baby.addGrowthStat(key);
            closeSheet();
          }}
          allowCustom
          needsValue
          customLabelPlaceholder={t("growth_weight")}
          customValuePlaceholder="7.8 kg"
          onConfirmCustom={(label, value) => {
            baby.addCustomGrowthStat(label, value);
            closeSheet();
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === "quickActions"} onClose={closeSheet}>
        <PickerSheetContent
          title={t("baby_quick_actions")}
          options={(Object.keys(QA_META) as QuickActionKey[])
            .filter((k) => !b.quickActionKeys.includes(k))
            .map<PickerOption>((k) => ({ key: k, label: t(QA_META[k].labelKey as never), icon: QA_META[k].icon }))}
          onSelect={(key) => {
            baby.addQuickAction(key as QuickActionKey);
            closeSheet();
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === "medical"} onClose={closeSheet}>
        <PickerSheetContent
          title={t("baby_medical_info")}
          options={baby.availableMedicalPresets().map<PickerOption>((m) => ({ key: m.key, label: t(m.labelKey as never) }))}
          onSelect={(key) => {
            baby.addMedicalRow(key);
            closeSheet();
          }}
          allowCustom
          needsValue
          customLabelPlaceholder={t("info_rh")}
          customValuePlaceholder="Rh+"
          onConfirmCustom={(label, value) => {
            baby.addCustomMedicalRow(label, value);
            closeSheet();
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === "timeline"} onClose={closeSheet}>
        <PickerSheetContent
          title={activeTab === "milestones" ? t("baby_tab_milestones") : t("baby_tab_timeline")}
          options={
            activeTab === "milestones"
              ? baby.availableMilestonePresets().map<PickerOption>((m) => ({ key: m.key, label: t(m.labelKey as never) }))
              : []
          }
          onSelect={(key) => {
            baby.addMilestone(key);
            closeSheet();
          }}
          allowCustom
          needsValue={activeTab !== "milestones"}
          customLabelPlaceholder={activeTab === "milestones" ? t("ms_smile") : t("label_field")}
          customValuePlaceholder="12 Korrik, 2025"
          onConfirmCustom={(label, value) => {
            if (activeTab === "milestones") baby.addCustomMilestone(label);
            else baby.addTimelineEvent(label, value);
            closeSheet();
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}
