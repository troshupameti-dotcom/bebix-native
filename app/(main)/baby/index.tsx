import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput, Alert, Share } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/baby/SectionHeader";
import { StatCard } from "@/components/baby/StatCard";
import { AddTile } from "@/components/baby/AddTile";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { InfoRow } from "@/components/baby/InfoRow";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PickerSheetContent, PickerOption } from "@/components/baby/PickerSheetContent";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { computeAgeText, formatDate, formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { NowCard } from "@/components/baby/NowCard";
import { DayClock } from "@/components/baby/DayClock";
import { liveStatus, durationLabel } from "@/lib/baby/dayStats";
import {
  buildDayClock,
  clockTotals,
  entryRefsInPeriod,
  periodFor,
  type ClockPeriod,
} from "@/lib/baby/dayClock";
import { groupByDay, dayLabelKind, type DiaryEntry, type DiaryKind } from "@/lib/baby/diary";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useInbox } from "@/lib/notifications/useInbox";

// Dy tabe, me një ndarje të vetme dhe të qartë: "Sot" është gjendja e
// tanishme e bebit (foto, ritmi, rritja, momentet, info mjekësore), "Ditari"
// është vetëm çfarë ndodhi, e renditur në kohë. Më parë Ditari mbante edhe
// momentet e arritjes edhe info mjekësore mes rreshtave me orë e datë —
// tri gjëra të ndryshme në një shtyllë të vetme.
const TABS = ["today", "diary"] as const;
type TabKey = (typeof TABS)[number];

type SheetContext = "growth" | "medical" | "timeline" | "statEdit" | null;

/** Etiketa e nje filtri — celesat ekzistojne, vetem hartohen ketu. */
function filterLabelKey(kind: DiaryKind | "all"): TranslationKey {
  switch (kind) {
    case "all": return "timeline_filter_all";
    case "feeding": return "tile_feeding";
    case "sleep": return "tile_sleep";
    case "diaper": return "diaper_title";
    case "growth": return "tile_growth";
    case "vaccine": return "qa_vaccinations";
    case "medical": return "medical_screen_title";
    case "event": return "baby_tab_timeline";
  }
}

/** Ikona dhe ngjyra e cdo lloj matjeje ne "Permbledhja e rritjes" — pesha,
 *  gjatesia dhe rrethi i kokes duhet te dallohen me nje veshtrim, jo vetem
 *  nga teksti. */
function growthAccent(key: string): { icon: IconName; tint: string; tintBg: string } {
  switch (key) {
    case "weight":
      return { icon: "cube", tint: "#B23A1C", tintBg: "#F3DCCF" };
    case "height":
      return { icon: "chart", tint: "#2E6FA8", tintBg: "#D9E7F2" };
    case "head":
      return { icon: "sparkle", tint: "#7A3596", tintBg: "#E7DAEF" };
    default:
      return { icon: "star", tint: "#6E7452", tintBg: "#E4E7DA" };
  }
}

/** Nje numer i vetem ne titullin e dites: ikona plus vlera, pa fjale. */
function DaySum({ icon, color, value }: { icon: IconName; color: string; value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={12} color={color} />
      <Text className="font-bodyMedium text-[11.5px] text-ink-soft">{value}</Text>
    </View>
  );
}

export default function BabyProfileScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const { profile } = state;
  const b = state.baby;
  const isDark = state.darkMode;
  const theme = useThemeColors();

  const [activeTab, setActiveTab] = useState<TabKey>("today");

  // Ritmi i dites llogaritet nje here per render: tre lista te njejta
  // perdoren nga tri pamje.
  const feedings = active(b.feedingLog);
  const sleeps = active(b.sleepLog);
  const diapers = active(b.diaperLog);
  // Gjysma e ditës që po shihet te ora. Nis te e tanishmja dhe ndryshon
  // vetëm kur prindi lëviz vetë.
  const [clockPeriod, setClockPeriod] = useState<ClockPeriod>(() => periodFor());
  const clock = useMemo(
    () => buildDayClock(feedings, sleeps, diapers, clockPeriod),
    [feedings, sleeps, diapers, clockPeriod]
  );
  const totals = useMemo(
    () => clockTotals(feedings, sleeps, diapers, clockPeriod),
    [feedings, sleeps, diapers, clockPeriod]
  );
  const clockRefs = useMemo(
    () => entryRefsInPeriod(feedings, sleeps, diapers, clockPeriod),
    [feedings, sleeps, diapers, clockPeriod]
  );

  function deleteClockPeriod() {
    haptics.warning();
    baby.bulkDelete(clockRefs);
    showToast(t("deleted_toast"), () => baby.bulkRestore(clockRefs));
  }
  const status = useMemo(() => liveStatus(feedings, sleeps, diapers), [feedings, sleeps, diapers]);
  const { unreadCount } = useInbox();

  function toggleSleep() {
    const ongoing = sleeps.find((entry) => !entry.endAt);
    if (ongoing) baby.endSleep(ongoing.id);
    else baby.startSleep(true);
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting_morning");
    if (hour < 18) return t("greeting_day");
    return t("greeting_evening");
  }
  const [editGrowth, setEditGrowth] = useState(false);
  const [editMedical, setEditMedical] = useState(false);
  const [sheet, setSheet] = useState<SheetContext>(null);
  const [timelineSheetPurpose, setTimelineSheetPurpose] = useState<"milestone" | "event">("event");
  const [editingStatKey, setEditingStatKey] = useState<string | null>(null);
  const [statValue, setStatValue] = useState("");
  const [statDate, setStatDate] = useState(new Date().toISOString());

  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<DiaryKind | "all">("all");
  // Filtrat rrinë të mbyllur: shtatë çipa gjithmonë në ekran ishin zhurmë
  // për një veprim që bëhet rrallë.
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function selectionKey(kind: DiaryKind, id: string) {
    return `${kind}-${id}`;
  }
  function toggleSelect(kind: DiaryKind, id: string) {
    haptics.select();
    const key = selectionKey(kind, id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function kindToRecordKind(k: DiaryKind): "growthHistory" | "feeding" | "sleep" | "diaper" | "vaccine" | "moment" | "medical" | "timeline" {
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
      return { kind: kindToRecordKind(kind as DiaryKind), id: rest.join("-") };
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
  /** Hyrjet e zgjedhura, të rrafshuara nga ditët. */
  function selectedEntries() {
    return diaryDays.flatMap((d) => d.entries).filter((f) => selectedIds.has(selectionKey(f.kind, f.id)));
  }
  function bulkShareSelected() {
    haptics.tap();
    const text = selectedEntries()
      .map((i) => {
        const iso = new Date(i.at).toISOString();
        return [formatDate(iso, lang), formatTime(iso, lang), i.title, i.detail].filter(Boolean).join(" · ");
      })
      .join("\n");
    Share.share({ message: text || t("timeline_empty") });
  }
  function bulkExportSelected() {
    haptics.tap();
    const csv = [
      "Kind,Date,Time,Title,Details",
      ...selectedEntries().map((i) => {
        const iso = new Date(i.at).toISOString();
        return `${i.kind},${formatDate(iso, lang)},${formatTime(iso, lang)},"${i.title}","${i.detail}"`;
      }),
    ].join("\n");
    Share.share({ message: csv });
  }

  const babyName = profile.nickname || profile.babyName || "Elira";
  const ageText = profile.babyDob ? computeAgeText(profile.babyDob, lang) : "";
  const upcomingVaccineCount = active(b.vaccines).filter((v) => !v.givenDate).length;

  function closeSheet() {
    setSheet(null);
    setEditingStatKey(null);
  }

  // Kliko direkt mbi kartën e rritjes (Pesha/Gjatësia/etj) — hap editim të
  // shpejtë, pa nevojë me aktivizu fillimisht "modalitetin e editimit".
  function openStatEdit(key: string, currentValue: string) {
    haptics.select();
    setEditingStatKey(key);
    setStatValue(currentValue);
    setStatDate(new Date().toISOString());
    setSheet("statEdit");
  }

  function saveStatEdit() {
    if (!editingStatKey) return;
    const stat = b.growthStats.find((g) => g.key === editingStatKey);
    baby.updateGrowthStat(editingStatKey, { value: statValue });
    if (stat && !stat.isCustom) {
      const num = parseFloat(statValue.replace(",", "."));
      if (!isNaN(num)) {
        if (stat.key === "weight") baby.addGrowthHistoryEntry({ date: statDate, weightKg: num });
        else if (stat.key === "height") baby.addGrowthHistoryEntry({ date: statDate, heightCm: num });
      }
    }
    haptics.success();
    setSheet(null);
    setEditingStatKey(null);
  }

  const editingStat = editingStatKey ? b.growthStats.find((g) => g.key === editingStatKey) ?? null : null;

  function toggleEdit(setter: (v: (p: boolean) => boolean) => void) {
    haptics.select();
    setter((v) => !v);
  }

  // ---- Sugjerimi i vetëm inteligjent — zëvendëson 8 butonat "Veprime të
  // shpejta". Shof cila gjë âsht ma e "vjetruar" (ushqyerje/pelenë) dhe
  // sugjeron vetëm atë, jo krejt opsionet njëkohësisht. ----
  const suggestion = useMemo(() => {
    const lastFeeding = active(b.feedingLog)[0];
    const lastDiaper = active(b.diaperLog)[0];
    const candidates: { label: string; hrs: number; icon: IconName; route: "/(main)/baby/feeding" | "/(main)/baby/diaper" }[] = [];
    if (lastFeeding) {
      // Date.now() ne render: keto jane shfaqje relative ndaj kohes (sa ore nga
      // ushqyerja/pelena e fundit) dhe duhet te rillogariten ne cdo render.
      // eslint-disable-next-line react-hooks/purity
      const hrs = (Date.now() - new Date(lastFeeding.at).getTime()) / 3600000;
      candidates.push({ label: "ushqyerjes", hrs, icon: "spoon", route: "/(main)/baby/feeding" });
    }
    if (lastDiaper) {
      // Date.now() ne render: keto jane shfaqje relative ndaj kohes (sa ore nga
      // ushqyerja/pelena e fundit) dhe duhet te rillogariten ne cdo render.
      // eslint-disable-next-line react-hooks/purity
      const hrs = (Date.now() - new Date(lastDiaper.at).getTime()) / 3600000;
      candidates.push({ label: "pelenës", hrs, icon: "baby", route: "/(main)/baby/diaper" });
    }
    if (candidates.length === 0) return null;
    const oldest = candidates.sort((x, y) => y.hrs - x.hrs)[0];
    if (oldest.hrs < 2) return null; // krejt âsht "e freskët", s'ka nevojë me sugjeru
    const hrsRounded = Math.floor(oldest.hrs);
    return { text: `Ka kalu ${hrsRounded} orë prej ${oldest.label} të fundit`, icon: oldest.icon, route: oldest.route };
  }, [b.feedingLog, b.diaperLog]);

  // ---- Rryma e ditarit ----
  // Çdo hyrje mban një "detail" të shkurtër në të djathtë (sasia, sa zgjati,
  // lloji). Më parë këto rrinin të ngjitura pas datës në të njëjtin rresht,
  // dhe rreshti lexohej si një varg i gjatë pa hierarki.
  const feed = useMemo<DiaryEntry[]>(() => {
    const items: DiaryEntry[] = [];
    active(b.timeline).forEach((ev) => {
      const ms = new Date(ev.date).getTime();
      items.push({
        id: ev.id,
        kind: "event",
        title: ev.title,
        detail: "",
        // Date.now() ne render: nje ngjarje pa date te vlefshme rri lart,
        // jo ne fund te listes.
        // eslint-disable-next-line react-hooks/purity
        at: isNaN(ms) ? Date.now() : ms,
        icon: "sparkle",
        tint: ev.color,
      });
    });
    active(b.feedingLog).forEach((f) =>
      items.push({
        id: f.id,
        kind: "feeding",
        title: t(`feeding_type_${f.type === "medicine" ? "medicine_short" : f.type}` as never),
        detail: f.amountMl
          ? `${f.amountMl} ml`
          : f.durationMin
            ? durationLabel(f.durationMin, t)
            : "",
        at: new Date(f.at).getTime(),
        icon: "spoon",
        tint: "orange",
      })
    );
    active(b.sleepLog).forEach((sl) => {
      const from = new Date(sl.startAt).getTime();
      const to = sl.endAt ? new Date(sl.endAt).getTime() : null;
      const minutes = to ? Math.max(0, Math.round((to - from) / 60000)) : undefined;
      items.push({
        id: sl.id,
        kind: "sleep",
        title: t("sleep_screen_title"),
        // Gjumi pa kohezgjatje eshte gjumi qe vazhdon tani.
        detail: minutes ? durationLabel(minutes, t) : t("diary_ongoing"),
        at: from,
        icon: "moon",
        tint: "olive",
        minutes,
      });
    });
    active(b.diaperLog).forEach((d) =>
      items.push({
        id: d.id,
        kind: "diaper",
        title: t("diaper_title"),
        detail: t(`diaper_type_${d.type}` as never),
        at: new Date(d.at).getTime(),
        icon: "baby",
        tint: "orange",
      })
    );
    active(b.growthHistory).forEach((g) =>
      items.push({
        id: g.id,
        kind: "growth",
        title: t("growth_screen_title"),
        detail: [g.weightKg ? `${g.weightKg} kg` : "", g.heightCm ? `${g.heightCm} cm` : ""]
          .filter(Boolean)
          .join(" · "),
        at: new Date(g.date).getTime(),
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
          detail: "",
          at: new Date(v.givenDate!).getTime(),
          icon: "syringe",
          tint: "olive",
        })
      );
    active(b.medicalRecords).forEach((m) =>
      items.push({
        id: m.id,
        kind: "medical",
        title: m.title,
        detail: t(`medical_type_${m.type}` as never),
        at: new Date(m.at).getTime(),
        icon: "shield",
        tint: "olive",
      })
    );
    return items.filter((item) => !isNaN(item.at));
  }, [b, t]);

  // Më parë ditari priste në heshtje gjithçka më të vjetër se shtatë ditë:
  // hyrjet ishin aty, por s'kishte asnjë mënyrë me i pa. Tash lista shkon
  // deri në fund, e ndarë sipas ditës.
  const searchQuery = search.trim().toLowerCase();
  const diaryDays = groupByDay(
    feed.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (
        searchQuery &&
        !item.title.toLowerCase().includes(searchQuery) &&
        !item.detail.toLowerCase().includes(searchQuery)
      ) {
        return false;
      }
      return true;
    })
  );


  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <View>
          <Text className="font-body text-xs text-ink-faint">
            {greeting()}{profile.parentName ? `, ${profile.parentName.split(" ")[0]}` : ""}
          </Text>
          <Text className="font-display text-2xl text-ink">{babyName}</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/(main)/notifications")}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("inbox_title")}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            style={shadows.press}
          >
            <Icon name="bell" size={16} color={isDark ? "#F7F1E4" : "#2C271F"} />
            {unreadCount > 0 && (
              <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange" />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/(main)/baby/settings")}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            style={shadows.press}
          >
            <Icon name="edit" size={16} color={isDark ? "#F7F1E4" : "#2C271F"} />
          </Pressable>
        </View>
      </View>

      {/* Segmented tab control — tash vetëm 2 tabe */}
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
                  style={[
                    shadows.press,
                    { position: "absolute", inset: 2, borderRadius: 14, backgroundColor: theme.surface },
                  ]}
                />
              )}
              <Text className={`text-center font-bodyMedium text-[13px] ${isActive ? "text-ink" : "text-ink-faint"}`}>
                {tab === "today" ? t("baby_tab_today") : t("baby_tab_diary")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {activeTab === "today" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            {/* Hero — foto e madhe, jo ikonë e vogël. Kjo âsht qendra
                emocionale e app-it, duhet me u ndje si e tillë. */}
            <View className="mt-2 items-center">
              {profile.babyPhoto ? (
                <Image source={{ uri: profile.babyPhoto }} style={{ width: "100%", aspectRatio: 1.3, borderRadius: 28 }} />
              ) : (
                <View
                  style={{ width: "100%", aspectRatio: 1.3, borderRadius: 28 }}
                  className="items-center justify-center bg-cream-soft"
                >
                  <Icon name="baby" size={44} color="#A79D8A" />
                </View>
              )}
              <Text className="mt-4 font-display text-[26px] text-ink">{babyName}</Text>
              {ageText ? <Text className="mt-0.5 font-body text-[14px] text-ink-soft">{ageText}</Text> : null}
              {profile.babyDob && (
                <Text className="mt-0.5 font-body text-[12px] text-ink-faint">
                  {t("baby_born")} {formatDate(profile.babyDob, lang)}
                </Text>
              )}
            </View>

            {/* Gjendja e castit dhe tre veprimet e perditshme — kjo pjese
                vinte nga faqja e vjeter kryesore, ku rrinte nje tab larg
                nga bebi dhe e perzier me produkte. */}
            <NowCard status={status} onToggleSleep={toggleSleep} />

            <DayClock
              clock={clock}
              totals={totals}
              gender={profile.babyGender}
              onChangePeriod={setClockPeriod}
              onDeletePeriod={deleteClockPeriod}
              deletableCount={clockRefs.length}
            />

            {/* Sugjerim i vetëm, kontekstual — jo 8 butona */}
            {suggestion && (
              <Pressable
                onPress={() => router.push(suggestion.route)}
                style={shadows.softLg}
                className="mt-5 flex-row items-center gap-3 rounded-2xl bg-ink px-4 py-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-on-accent/15">
                  <Icon name={suggestion.icon} size={16} color="#FBF6EE" />
                </View>
                <Text className="flex-1 font-bodyMedium text-[13.5px] text-cream">{suggestion.text}</Text>
                <Icon name="chevronRight" size={16} color="#FBF6EE" />
              </Pressable>
            )}

            {/* Lidhje të shpejta minimale — vetëm 2, jo 8 */}
            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => router.push("/(main)/baby/vaccinations")}
                style={shadows.soft}
                className="flex-1 flex-row items-center gap-2.5 rounded-xl2 border border-ink/10 bg-surface p-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-olive-bg">
                  <Icon name="syringe" size={16} color="#6E7452" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[13px] text-ink">{t("vaccine_screen_title")}</Text>
                  <Text className="font-body text-[10.5px] text-ink-soft">
                    {upcomingVaccineCount} {t("vaccine_status_upcoming").toLowerCase()}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(main)/baby/medical")}
                style={shadows.soft}
                className="flex-1 flex-row items-center gap-2.5 rounded-xl2 border border-ink/10 bg-surface p-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-orange-bg">
                  <Icon name="shield" size={16} color="#C9702E" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[13px] text-ink">{t("medical_screen_title")}</Text>
                  <Text className="font-body text-[10.5px] text-ink-soft">{active(b.medicalRecords).length}</Text>
                </View>
              </Pressable>
            </View>

            {/* Growth summary */}
            <SectionHeader title={t("baby_growth_summary")} editable editing={editGrowth} onToggleEdit={() => toggleEdit(setEditGrowth)} />
            <View className="flex-row flex-wrap gap-3">
              {b.growthStats.map((g) => (
                <Pressable key={g.key} disabled={editGrowth} onPress={() => openStatEdit(g.key, g.value)} style={{ width: "47.5%" }}>
                  <StatCard
                    label={g.isCustom ? g.label ?? "" : t(g.labelKey as never)}
                    value={g.value}
                    sub={g.isCustom ? undefined : g.subKey ? t(g.subKey as never) : undefined}
                    editing={editGrowth}
                    isCustom={g.isCustom}
                    onChangeValue={(v) => baby.updateGrowthStat(g.key, { value: v })}
                    onChangeLabel={(v) => baby.updateGrowthStat(g.key, { label: v })}
                    onRemove={() => baby.removeGrowthStat(g.key)}
                    {...growthAccent(g.key)}
                  />
                </Pressable>
              ))}
              {editGrowth && (
                <View style={{ width: "47.5%" }}>
                  <AddTile onPress={() => setSheet("growth")} />
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/(main)/baby/growth")} className="mt-3 items-center rounded-2xl bg-ink py-3.5">
              <Text className="font-bodyMedium text-[14px] text-cream">{t("baby_see_chart")}</Text>
            </Pressable>

            {/* Info mjekësore — dikur ishte tab "Shëndeti", tash pjesë kompakte e Ditarit */}
            <SectionHeader title={t("baby_medical_info")} editable editing={editMedical} onToggleEdit={() => toggleEdit(setEditMedical)} />
            <View style={shadows.soft} className="rounded-xl2 border border-ink/10 bg-surface px-4">
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

        {activeTab === "diary" && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 200 }}>
            {/* Një rresht kontrollesh. Më parë kërkimi, zgjedhja dhe shtatë
                çipa filtri rrinin gjithmonë në ekran — më shumë vend se vetë
                ditari. Tash filtrat hapen kur duhen. */}
            <View className="mt-2 flex-row items-center gap-2">
              {showSearch ? (
                <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3.5 py-2.5">
                  <Icon name="search" size={15} color="#A79D8A" />
                  <TextInput
                    autoFocus
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("timeline_search_ph")}
                    placeholderClassName="text-ink-faint"
                    className="flex-1 font-body text-[13.5px] text-ink"
                  />
                  <Pressable onPress={() => { setShowSearch(false); setSearch(""); }} hitSlop={8}>
                    <Icon name="close" size={14} color="#A79D8A" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text className="flex-1 font-bodySemibold text-[15px] text-ink">{t("baby_tab_timeline")}</Text>
                  <Pressable
                    onPress={() => setShowSearch(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("timeline_search_ph")}
                    className="h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface"
                  >
                    <Icon name="search" size={15} color={isDark ? "#F7F1E4" : "#2C271F"} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      haptics.select();
                      setShowFilters((v) => !v);
                    }}
                    className={`rounded-full px-3.5 py-2 ${kindFilter !== "all" ? "bg-ink" : "border border-ink/10 bg-surface"}`}
                  >
                    <Text className={`font-bodyMedium text-[12px] ${kindFilter !== "all" ? "text-cream" : "text-ink"}`}>
                      {kindFilter === "all" ? t("diary_filter") : t(filterLabelKey(kindFilter))}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      haptics.select();
                      if (selectMode) exitSelectMode();
                      else setSelectMode(true);
                    }}
                    className={`h-9 w-9 items-center justify-center rounded-full ${selectMode ? "bg-ink" : "border border-ink/10 bg-surface"}`}
                  >
                    <Icon name="check" size={15} color={selectMode ? "#FBF6EE" : isDark ? "#F7F1E4" : "#2C271F"} />
                  </Pressable>
                </>
              )}
            </View>

            {showFilters && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
                {(["all", "feeding", "sleep", "diaper", "growth", "vaccine", "medical"] as const).map((k) => {
                  const isActive = kindFilter === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        haptics.select();
                        setKindFilter(k);
                      }}
                      className={`rounded-full border px-3.5 py-2 ${isActive ? "border-ink bg-ink" : "border-ink/10 bg-surface"}`}
                    >
                      <Text className={`font-bodyMedium text-[12px] ${isActive ? "text-cream" : "text-ink"}`}>{t(filterLabelKey(k))}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Lista, e ndarë sipas ditës. Data del një herë si titull dhe
                mban përmbledhjen e asaj dite; rreshti mban vetëm orën. */}
            {diaryDays.length === 0 ? (
              <View className="items-center gap-2 py-14">
                <Icon name="sparkle" size={24} color="#E9DFCC" />
                <Text className="font-body text-sm text-ink-soft">
                  {search.trim() || kindFilter !== "all" ? t("diary_no_match") : t("timeline_empty")}
                </Text>
              </View>
            ) : (
              diaryDays.map((day) => {
                const label = dayLabelKind(day);
                return (
                  <View key={day.key} className="mt-6">
                    <View className="flex-row items-center justify-between border-b border-ink/10 pb-2">
                      <Text className="font-bodySemibold text-[14px] text-ink">
                        {label.kind === "today"
                          ? t("diary_today")
                          : label.kind === "yesterday"
                            ? t("diary_yesterday")
                            : formatDate(label.date.toISOString(), lang)}
                      </Text>
                      <View className="flex-row items-center gap-3">
                        {day.feedings > 0 && <DaySum icon="spoon" color={theme.orange} value={String(day.feedings)} />}
                        {day.sleepMinutes > 0 && <DaySum icon="moon" color={theme.olive} value={durationLabel(day.sleepMinutes, t)} />}
                        {day.diapers > 0 && <DaySum icon="baby" color={theme.inkFaint} value={String(day.diapers)} />}
                      </View>
                    </View>

                    {day.entries.map((item, idx) => {
                      const key = selectionKey(item.kind, item.id);
                      const isSelected = selectedIds.has(key);
                      const isLast = idx === day.entries.length - 1;
                      const badgeBg = item.tint === "orange" ? theme.orangeBg : theme.oliveBg;
                      const badgeFg = item.tint === "orange" ? theme.orange : theme.olive;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => (selectMode ? toggleSelect(item.kind, item.id) : undefined)}
                          className="flex-row items-start gap-3"
                        >
                          {/* Shirit kohe: koha dhe nje vije e vazhdueshme qe lidh
                              ikonat — si te aplikacionet e tjera te ndjekjes,
                              jo vetem nje rresht teksti. */}
                          <View className="items-center" style={{ width: 40 }}>
                            <Text className="mb-1.5 font-body text-[11px] text-ink-faint">
                              {formatTime(new Date(item.at).toISOString(), lang)}
                            </Text>
                            <View
                              className="h-8 w-8 items-center justify-center rounded-full"
                              style={{ backgroundColor: badgeBg }}
                            >
                              <Icon name={item.icon} size={14} color={badgeFg} />
                            </View>
                            {!isLast && <View className="mt-1 w-px flex-1 bg-ink/10" style={{ minHeight: 14 }} />}
                          </View>

                          <View
                            className="mb-3 flex-1 flex-row items-center justify-between rounded-xl2 border border-ink/10 bg-surface px-3.5 py-3"
                            style={shadows.soft}
                          >
                            <View className="flex-1 flex-row items-center gap-2">
                              {selectMode && (
                                <View className={`h-4 w-4 items-center justify-center rounded-full border ${isSelected ? "border-ink bg-ink" : "border-ink/25 bg-surface"}`}>
                                  {isSelected && <Icon name="check" size={9} color={isDark ? "#211D17" : "#FBF6EE"} />}
                                </View>
                              )}
                              <Text className="flex-1 font-bodyMedium text-[14px] text-ink" numberOfLines={1}>
                                {item.title}
                              </Text>
                            </View>
                            {item.detail ? (
                              <Text className="ml-2 font-body text-[12.5px] text-ink-soft">{item.detail}</Text>
                            ) : null}
                            {!selectMode && item.kind === "event" && (
                              <Pressable
                                onPress={() => {
                                  haptics.warning();
                                  baby.deleteTimelineEvent(item.id);
                                  showToast(t("deleted_toast"), () => baby.restoreTimelineEvent(item.id));
                                }}
                                hitSlop={8}
                                className="ml-2"
                              >
                                <Icon name="close" size={14} color="#A79D8A" />
                              </Pressable>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            )}

            {selectMode && selectedIds.size > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 180 }}
                style={shadows.softLg}
                className="mt-4 flex-row items-center justify-between rounded-2xl bg-ink px-4 py-3"
              >
                <Text className="font-bodyMedium text-[12.5px] text-cream">
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

            <Pressable
              onPress={() => { setTimelineSheetPurpose("event"); setSheet("timeline"); }}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-cream-line py-3.5"
            >
              <Icon name="plus" size={14} color="#6E7452" />
              <Text className="font-bodyMedium text-[13.5px] text-olive">{t("add_action")}</Text>
            </Pressable>
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

      <BottomSheet visible={sheet === "statEdit"} onClose={closeSheet}>
        <View className="gap-4">
          <Text className="font-bodySemibold text-base text-ink">
            {editingStat?.isCustom ? editingStat.label ?? "" : editingStat ? t(editingStat.labelKey as never) : ""}
          </Text>
          <DateTimeField label={t("date_field")} mode="date" value={statDate} onChange={setStatDate} />
          <FormField label={t("value_field")} value={statValue} onChangeText={setStatValue} />
          <Pressable onPress={saveStatEdit} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">{t("save_action")}</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === "timeline"} onClose={closeSheet}>
        <PickerSheetContent
          title={timelineSheetPurpose === "milestone" ? t("baby_tab_milestones") : t("baby_tab_timeline")}
          options={
            timelineSheetPurpose === "milestone"
              ? baby.availableMilestonePresets().map<PickerOption>((m) => ({ key: m.key, label: t(m.labelKey as never) }))
              : []
          }
          onSelect={(key) => {
            baby.addMilestone(key);
            closeSheet();
          }}
          allowCustom
          needsValue={timelineSheetPurpose === "event"}
          customLabelPlaceholder={timelineSheetPurpose === "milestone" ? t("ms_smile") : t("label_field")}
          customValuePlaceholder="12 Korrik, 2025"
          onConfirmCustom={(label, value) => {
            if (timelineSheetPurpose === "milestone") baby.addCustomMilestone(label);
            else baby.addTimelineEvent(label, value);
            closeSheet();
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}