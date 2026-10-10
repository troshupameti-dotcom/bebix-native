import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput, Alert, Share } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/baby/SectionHeader";
import { StatCard } from "@/components/baby/StatCard";
import { GrowthOverview } from "@/components/baby/GrowthOverview";
import { latestGrowth } from "@/lib/baby/growthLatest";
import { parseBloodType } from "@/lib/baby/medicalSync";
import { AddTile } from "@/components/baby/AddTile";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { MedicalTile } from "@/components/baby/MedicalTile";
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
import { TodayCard } from "@/components/baby/TodayCard";
import { WeeklyRecapCard } from "@/components/baby/WeeklyRecapCard";
import { MemoriesCard } from "@/components/baby/MemoriesCard";
import { CelebrationModal } from "@/components/baby/CelebrationModal";
import { useCelebration } from "@/lib/baby/useCelebration";
import { TeamCard } from "@/components/baby/TeamCard";
import { ShopSuggestionCard } from "@/components/shop/ShopSuggestionCard";
import { FamilyView } from "@/components/baby/FamilyView";
import { useHouseholdRole } from "@/lib/hooks/useHouseholdRole";
import { NightMode } from "@/components/baby/NightMode";
import { CheckInCard } from "@/components/parent/CheckInCard";
import { DevelopmentCard } from "@/components/parent/DevelopmentCard";
import { PostpartumCard } from "@/components/parent/PostpartumCard";
import { setNightOverride, useNightMode } from "@/lib/baby/nightMode";
import { SyncBadge } from "@/components/baby/SyncBadge";
import { DayClock } from "@/components/baby/DayClock";
import { liveStatus, durationLabel } from "@/lib/baby/dayStats";
import { isNapAt } from "@/lib/baby/sleepKind";
import {
  buildDayClock,
  clockTotals,
  entryRefsInPeriod,
  periodFor,
  type ClockPeriod,
} from "@/lib/baby/dayClock";
import {
  groupByDay,
  dayLabelKind,
  dayKeyOf,
  dayMarks,
  startOfDay,
  SPECIAL_KINDS,
  type DiaryDay,
  type DiaryEntry,
  type DiaryKind,
} from "@/lib/baby/diary";
import { DiaryCalendar } from "@/components/baby/DiaryCalendar";
import { DiaryWeek } from "@/components/baby/DiaryWeek";
import { clockPalette } from "@/lib/baby/clockPalette";
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

/** Pllakë e përmbledhjes së ditës: e njëjta ngjyrë si pika e kalendarit. */
function DayTile({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: `${color}1F`, width: "48.5%" }}>
      <Text className="font-bodySemibold text-[11px] uppercase" style={{ color }}>
        {label}
      </Text>
      <Text className="mt-1 font-display text-[17px] text-ink">{value}</Text>
    </View>
  );
}

export default function BabyProfileScreen() {
  const { t, lang } = useTranslation();
  const { state, baby, updateProfile } = useAppState();
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
  // Lista e detajuar e nje lloji (p.sh. "te gjitha gjumet") vjen nga 24 oret
  // e fundit, jo vetem nga gjysma qe po shihet: nje gjume mund te fillojë
  // paradite dhe te vazhdojë pasdite, dhe prindi qe pyet "sa here fjeti sot"
  // pret pergjigjen per gjithe diten, jo per gjysmen e treguar ne rreth.
  const itemsLast24h = useMemo(() => {
    // Dritarja e fundit 24-oreshe rillogaritet ne cdo thirrje te memo-s
    // (kur ndryshojne te dhenat), jo vetem ne montim.
    const now = new Date();
    const period = { start: new Date(now.getTime() - 24 * 3600000), end: now, isAm: true };
    return buildDayClock(feedings, sleeps, diapers, period, now).items;
  }, [feedings, sleeps, diapers]);

  function deleteClockPeriod() {
    haptics.warning();
    baby.bulkDelete(clockRefs);
    showToast(t("deleted_toast"), () => baby.bulkRestore(clockRefs));
  }
  const status = useMemo(() => liveStatus(feedings, sleeps, diapers), [feedings, sleeps, diapers]);
  const { unreadCount } = useInbox();

  function toggleSleep() {
    const ongoing = sleeps.find((entry) => !entry.endAt);
    haptics.success();
    if (ongoing) baby.endSleep(ongoing.id);
    else baby.startSleep(isNapAt(new Date()));
    showToast(t(ongoing ? "sleep_saved_end" : "sleep_saved_start"));
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

  // Ditari hapet te kalendari, në ditën e sotme. "Javë" është raporti.
  const [diaryView, setDiaryView] = useState<"day" | "week">("day");
  const [diaryToday] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(diaryToday);
  const [calMonth, setCalMonth] = useState({ y: diaryToday.getFullYear(), m: diaryToday.getMonth() });

  function pickDiaryDay(day: Date) {
    setSelectedDay(startOfDay(day));
    setCalMonth({ y: day.getFullYear(), m: day.getMonth() });
  }

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
  /** Hyrjet e zgjedhura, nga të gjitha ditët — zgjedhja mund të kalojë disa ditë. */
  function selectedEntries() {
    return allDiaryDays.flatMap((d) => d.entries).filter((f) => selectedIds.has(selectionKey(f.kind, f.id)));
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

  // Pa emër: "Bebi", jo emri demo "Elira" që u dilte të gjithë prindërve pa emër.
  const babyName = profile.nickname || profile.babyName || t("your_baby");
  // Dita e 100-të, muajt, ditëlindja, arritjet e reja — një herë secila.
  const celebration = useCelebration(profile.babyDob, b.moments);
  // Gjyshërit (vetëm shikim) shohin pamjen e familjes, pa butona shënimi.
  const role = useHouseholdRole();
  // Ora 3 e natës: ekran i errët me butona të mëdhenj (vetë natën ose me 🌙).
  const night = useNightMode();
  const ageText = profile.babyDob ? computeAgeText(profile.babyDob, lang) : "";
  const upcomingVaccineCount = active(b.vaccines).filter((v) => !v.givenDate).length;
  const growth = useMemo(() => latestGrowth(b.growthHistory), [b.growthHistory]);

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
        else if (stat.key === "head") baby.addGrowthHistoryEntry({ date: statDate, headCm: num });
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
    const candidates: { kind: "feeding" | "diaper"; hrs: number; icon: IconName; route: "/(main)/baby/feeding" | "/(main)/baby/diaper" }[] = [];
    if (lastFeeding) {
      // Date.now() ne render: keto jane shfaqje relative ndaj kohes (sa ore nga
      // ushqyerja/pelena e fundit) dhe duhet te rillogariten ne cdo render.
      // eslint-disable-next-line react-hooks/purity
      const hrs = (Date.now() - new Date(lastFeeding.at).getTime()) / 3600000;
      candidates.push({ kind: "feeding", hrs, icon: "spoon", route: "/(main)/baby/feeding" });
    }
    if (lastDiaper) {
      // Date.now() ne render: keto jane shfaqje relative ndaj kohes (sa ore nga
      // ushqyerja/pelena e fundit) dhe duhet te rillogariten ne cdo render.
      // eslint-disable-next-line react-hooks/purity
      const hrs = (Date.now() - new Date(lastDiaper.at).getTime()) / 3600000;
      candidates.push({ kind: "diaper", hrs, icon: "baby", route: "/(main)/baby/diaper" });
    }
    if (candidates.length === 0) return null;
    const oldest = candidates.sort((x, y) => y.hrs - x.hrs)[0];
    if (oldest.hrs < 2) return null; // krejt âsht "e freskët", s'ka nevojë me sugjeru
    const hrsRounded = Math.floor(oldest.hrs);
    const text = t(oldest.kind === "feeding" ? "baby_since_feeding" : "baby_since_diaper", { n: hrsRounded });
    return { text, icon: oldest.icon, route: oldest.route };
  }, [b.feedingLog, b.diaperLog, t]);

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
  // React Compiler i memorizon vetë; `useMemo` manual këtu e bllokonte.
  const filteredFeed = kindFilter === "all" ? feed : feed.filter((item) => item.kind === kindFilter);
  // Kalendari dhe java lexojnë nga kjo; kërkimi shkon në gjithë historikun.
  const allDiaryDays = groupByDay(filteredFeed);
  const diaryDaysByKey = new Map<string, DiaryDay>(allDiaryDays.map((d) => [d.key, d]));
  const diaryMarks = dayMarks(allDiaryDays);
  const diaryDays = searchQuery
    ? groupByDay(
        filteredFeed.filter(
          (item) => item.title.toLowerCase().includes(searchQuery) || item.detail.toLowerCase().includes(searchQuery)
        )
      )
    : allDiaryDays;
  const selectedDiaryDay = diaryDaysByKey.get(dayKeyOf(selectedDay.getTime()));
  // Dita lexohet nga mëngjesi në mbrëmje; lista e kërkimit mbetet më e reja lart.
  const selectedDayEntries = selectedDiaryDay ? [...selectedDiaryDay.entries].sort((a, b) => a.at - b.at) : [];
  const diaryColors = clockPalette(profile.babyGender, theme);

  function changeDiaryMonth(delta: -1 | 1) {
    const next = new Date(calMonth.y, calMonth.m + delta, 1);
    const y = next.getFullYear();
    const m = next.getMonth();
    setCalMonth({ y, m });
    // Zgjidh ditën më të fundit me shënime në atë muaj, që poshtë kalendarit
    // të mos mbetet dita e muajit tjetër.
    if (y === diaryToday.getFullYear() && m === diaryToday.getMonth()) {
      setSelectedDay(diaryToday);
      return;
    }
    const lastLogged = allDiaryDays.find((d) => d.date.getFullYear() === y && d.date.getMonth() === m);
    setSelectedDay(lastLogged ? lastLogged.date : new Date(y, m + 1, 0));
  }

  function changeDiaryWeek(delta: -1 | 1) {
    const next = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() + delta * 7);
    pickDiaryDay(next.getTime() > diaryToday.getTime() ? diaryToday : next);
  }

  const diaryWeekdaysLong = t("diary_weekdays_long").split(",");
  const diaryMonthsOf = t("diary_months_of").split(",");
  const selectedDayTitle = t("diary_day_title", {
    weekday: diaryWeekdaysLong[(selectedDay.getDay() + 6) % 7],
    day: selectedDay.getDate(),
    month: diaryMonthsOf[selectedDay.getMonth()],
  });
  const selectedIsToday = selectedDay.getTime() === diaryToday.getTime();

  /** Një rresht i ditarit: ora, ikona në shiritin e kohës dhe kartela. */
  function renderDiaryEntry(item: DiaryEntry, idx: number, list: DiaryEntry[]) {
    const key = selectionKey(item.kind, item.id);
    const isSelected = selectedIds.has(key);
    const isLast = idx === list.length - 1;
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
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: badgeBg }}>
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
          {item.detail ? <Text className="ml-2 font-body text-[12.5px] text-ink-soft">{item.detail}</Text> : null}
          {!selectMode && item.kind === "event" && (
            <Pressable
              onPress={() => {
                haptics.warning();
                baby.deleteTimelineEvent(item.id);
                showToast(t("deleted_toast"), () => baby.restoreTimelineEvent(item.id));
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("delete_action")}
              className="ml-2"
            >
              <Icon name="close" size={14} color="#A79D8A" />
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  }


  if (night.active && role !== "viewer") return <NightMode />;

  if (role === "viewer") {
    return (
      <>
        <FamilyView profile={profile} baby={b} babyName={babyName} ageText={ageText} />
        <CelebrationModal celebration={celebration.current} babyName={babyName} onClose={celebration.dismiss} canAddPhoto={false} />
      </>
    );
  }

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
            onPress={() => {
              haptics.tap();
              setNightOverride("on");
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("night_turn_on")}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            style={shadows.press}
          >
            <Icon name="moon" size={16} color={isDark ? "#F7F1E4" : "#2C271F"} />
          </Pressable>
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
            accessibilityRole="button" accessibilityLabel={t("a11y_edit")}
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

            {/* Si je sot? (privat, një herë në ditë) dhe, për mamin, javët pas lindjes. */}
            <CheckInCard parentName={profile.parentName} />
            <PostpartumCard babyDob={profile.babyDob} relation={profile.relation} />

            {/* Dy prindër: kush bëri çfarë sot, faleminderit, turni i natës. */}
            <TeamCard />

            {/* E hënë–e mërkurë: java e kaluar, vetëm lajmet e mira si trend. */}
            <WeeklyRecapCard feedings={feedings} sleeps={sleeps} diapers={diapers} babyName={profile.babyName} />

            {/* Çfarë vjen më pas, nga ritmi i vetë bebit. */}
            <TodayCard feedings={feedings} sleeps={sleeps} diapers={diapers} babyDob={profile.babyDob} />

            {/* Këtë javë: çfarë mëson bebi + 3 ide loje (përmbajtja nga paneli). */}
            <DevelopmentCard babyDob={profile.babyDob} />

            {/* Dyqani: një kartë e vetme (pelenat, madhësia, mosha), mbyllet me "Jo tani". */}
            <ShopSuggestionCard />

            {/* Kujtimet: sot para 1 muaji / 1 viti, filmi i muajit, kapsula, libri. */}
            <MemoriesCard baby={b} profile={profile} babyName={babyName} />

            <DayClock
              clock={clock}
              totals={totals}
              gender={profile.babyGender}
              onChangePeriod={setClockPeriod}
              onDeletePeriod={deleteClockPeriod}
              deletableCount={clockRefs.length}
              itemsLast24h={itemsLast24h}
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
            {/* Pesha dhe gjatësia lexohen nga historiku i rritjes (që sinkronizohet),
                jo nga kartat e ruajtura vetëm në telefon. */}
            <GrowthOverview
              latest={growth}
              onAdd={(entry) => baby.addGrowthHistoryEntry(entry)}
              onOpenChart={() => router.push("/(main)/baby/growth")}
            />
            <View className="mt-3 flex-row flex-wrap gap-3">
              {b.growthStats.filter((g) => g.key !== "weight" && g.key !== "height").map((g) => (
                <Pressable key={g.key} disabled={editGrowth} onPress={() => openStatEdit(g.key, g.value)} style={{ width: "47.5%" }}>
                  <StatCard
                    label={g.isCustom ? g.label ?? "" : t(g.labelKey as never)}
                    value={g.key === "head" && growth.head ? `${growth.head.value} cm` : g.value}
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

            {/* Info mjekësore — dikur ishte tab "Shëndeti", tash pjesë kompakte e Ditarit */}
            <SectionHeader title={t("baby_medical_info")} editable editing={editMedical} onToggleEdit={() => toggleEdit(setEditMedical)} />
            <View className="flex-row flex-wrap gap-3">
              {b.medicalInfo
                .filter((m) => b.medicalActiveKeys.includes(m.key))
                .map((m) => (
                  <View key={m.key} style={{ width: "47.5%" }}>
                    <MedicalTile
                      rowKey={m.key}
                      label={m.isCustom ? m.label ?? "" : t(m.labelKey as never)}
                      value={m.value}
                      isCustom={m.isCustom}
                      editing={editMedical}
                      placeholder={t("value_field")}
                      onChangeValue={(v) => {
                        baby.updateMedicalRow(m.key, { value: v });
                        // Drejtimi tjetër: grupi i gjakut, mjeku dhe alergjitë mbeten
                        // të njëjta edhe te cilësimet e bebit.
                        if (m.key === "doctor") updateProfile({ pediatrician: v });
                        else if (m.key === "allergies") updateProfile({ allergies: v });
                        else if (m.key === "blood") {
                          const blood = parseBloodType(v);
                          if (blood !== undefined) updateProfile({ bloodType: blood });
                        }
                      }}
                      onChangeLabel={(v) => baby.updateMedicalRow(m.key, { label: v })}
                      onRemove={() => baby.removeMedicalRow(m.key)}
                    />
                  </View>
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
            <SyncBadge />
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
                  <Pressable accessibilityRole="button" accessibilityLabel={t("a11y_close")} onPress={() => { setShowSearch(false); setSearch(""); }} hitSlop={8}>
                    <Icon name="close" size={14} color="#A79D8A" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View className="flex-1 flex-row">
                    <View className="flex-row rounded-full bg-cream-soft p-1">
                      {(["day", "week"] as const).map((v) => {
                        const on = diaryView === v;
                        return (
                          <Pressable
                            key={v}
                            onPress={() => {
                              haptics.select();
                              setDiaryView(v);
                            }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                            className={`rounded-full px-4 py-2 ${on ? "bg-surface" : ""}`}
                            style={on ? shadows.soft : undefined}
                          >
                            <Text className={`text-[13px] ${on ? "font-bodySemibold text-ink" : "font-bodyMedium text-ink-soft"}`}>
                              {t(v === "day" ? "diary_view_day" : "diary_view_week")}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
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
                    accessibilityRole="button" accessibilityLabel={t("a11y_select")}
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

            {searchQuery ? (
              // Kërkimi shkon në gjithë historikun, prandaj rezultatet dalin si
              // listë e ndarë sipas ditës, jo te kalendari.
              <>
                <Text className="mt-5 font-bodySemibold text-[13px] uppercase text-ink-faint">{t("diary_search_results")}</Text>
                {diaryDays.length === 0 ? (
                  <View className="items-center gap-2 py-14">
                    <Icon name="sparkle" size={24} color="#E9DFCC" />
                    <Text className="font-body text-sm text-ink-soft">{t("diary_no_match")}</Text>
                  </View>
                ) : (
                  diaryDays.map((day) => {
                    const label = dayLabelKind(day);
                    return (
                      <View key={day.key} className="mt-5">
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
                        <View className="mt-3">{day.entries.map(renderDiaryEntry)}</View>
                      </View>
                    );
                  })
                )}
              </>
            ) : diaryView === "day" ? (
              <View className="mt-4 gap-4">
                <DiaryCalendar
                  year={calMonth.y}
                  month={calMonth.m}
                  selected={selectedDay}
                  today={diaryToday}
                  marks={diaryMarks}
                  gender={profile.babyGender}
                  onSelect={pickDiaryDay}
                  onChangeMonth={changeDiaryMonth}
                />

                <View className="rounded-xl2 border border-cream-line bg-surface p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 font-display text-lg text-ink">{selectedDayTitle}</Text>
                    {selectedIsToday ? (
                      <View className="rounded-full bg-olive-bg px-2.5 py-1">
                        <Text className="font-bodySemibold text-[11px] text-olive">{t("diary_today")}</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          haptics.select();
                          pickDiaryDay(diaryToday);
                        }}
                        accessibilityRole="button"
                        className="rounded-full border border-cream-line px-3 py-1.5"
                      >
                        <Text className="font-bodySemibold text-[12px] text-ink">{t("diary_back_today")}</Text>
                      </Pressable>
                    )}
                  </View>

                  {selectedDiaryDay ? (
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <DayTile
                        color={diaryColors.sleep}
                        label={t("diary_sum_sleep")}
                        value={selectedDiaryDay.sleepMinutes ? durationLabel(selectedDiaryDay.sleepMinutes, t) : "—"}
                      />
                      <DayTile
                        color={diaryColors.feeding}
                        label={t("diary_sum_feeds")}
                        value={t("diary_times", { n: selectedDiaryDay.feedings })}
                      />
                      <DayTile color={diaryColors.diaper} label={t("diary_sum_diapers")} value={String(selectedDiaryDay.diapers)} />
                      <DayTile
                        color={diaryColors.poop}
                        label={t("diary_sum_events")}
                        value={String(selectedDiaryDay.entries.filter((e) => SPECIAL_KINDS.has(e.kind)).length)}
                      />
                    </View>
                  ) : (
                    <Text className="mt-3 font-body text-[13.5px] leading-5 text-ink-soft">{t("diary_day_empty")}</Text>
                  )}
                </View>

                {selectedDayEntries.length > 0 && <View>{selectedDayEntries.map(renderDiaryEntry)}</View>}
              </View>
            ) : (
              <View className="mt-4">
                <DiaryWeek
                  anchor={selectedDay}
                  today={diaryToday}
                  daysByKey={diaryDaysByKey}
                  gender={profile.babyGender}
                  onChangeWeek={changeDiaryWeek}
                  onPickDay={(d) => {
                    pickDiaryDay(d);
                    setDiaryView("day");
                  }}
                />
              </View>
            )}

            {!searchQuery && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push("/(main)/baby/export");
                }}
                accessibilityRole="button"
                className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-olive bg-surface py-3.5"
              >
                <Icon name="download" size={15} color={theme.olive} />
                <Text className="font-bodySemibold text-[13.5px] text-olive">{t("diary_report_doctor")}</Text>
              </Pressable>
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
                  <Pressable accessibilityRole="button" accessibilityLabel={t("a11y_archive")} onPress={bulkArchiveSelected} hitSlop={6}>
                    <Icon name="download" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("a11y_export")} onPress={bulkExportSelected} hitSlop={6}>
                    <Icon name="chart" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("a11y_share")} onPress={bulkShareSelected} hitSlop={6}>
                    <Icon name="share" size={17} color="#FBF6EE" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("a11y_delete")} onPress={bulkDeleteSelected} hitSlop={6}>
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
      <CelebrationModal celebration={celebration.current} babyName={babyName} onClose={celebration.dismiss} />
    </SafeAreaView>
  );
}