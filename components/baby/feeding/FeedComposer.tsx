import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, DeviceEventEmitter } from "react-native";
import { MotiView } from "moti";
import { Check, Minus, Pause, Play, Plus } from "lucide-react-native";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToneTheme, type ThemedTone } from "@/lib/theme/tone";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { durationLabel } from "@/lib/baby/dayStats";
import {
  BREAST_TIMER_EVENT, elapsedSeconds, finishTimer, formatElapsed, isPaused, loadLastEnd, loadTimer, pauseTimer, resumeTimer,
  saveLastEnd, saveTimer, sideSeconds, startTimer, suggestedSide, switchSide, type BreastTimer,
} from "@/lib/baby/breastTimer";
import { MAX_ML, foodChoices, quickAmounts, recentFoods, stepMl } from "@/lib/baby/feedingDays";
import type { FeedingEntry, FeedingType } from "@/lib/state/types";
import { TYPE_ICON, TYPE_TONE, compactDuration } from "./feedingStyle";

type Tab = "breast" | "bottle" | "solid";
type Side = "left" | "right";
type Milk = "bottle" | "formula";

const TABS: Tab[] = ["breast", "bottle", "solid"];
const TAB_TYPE: Record<Tab, FeedingType> = { breast: "breast", bottle: "bottle", solid: "solid" };
/** "Kur?": tani, ose sa minuta më parë (prindi shpesh e shënon pasi ka mbaruar). */
const WHEN_AGO = [0, 15, 30, 60];
/** Gjiri pa kohëmatës: sa zgjati ushqyerja që sapo mbaroi. */
const DONE_MIN = [5, 10, 15, 20, 30];
const CIRCLE = 112;

/** Çasti para `min` minutash (ISO), për shënimet e bëra pasi ushqyerja ka mbaruar. */
const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function tabOf(type: FeedingType | undefined): Tab {
  if (type === "solid") return "solid";
  if (type === "bottle" || type === "formula") return "bottle";
  return "breast";
}

export type FeedPrefill = Partial<Pick<FeedingEntry, "type" | "amountMl" | "side" | "foodCategory">>;

/**
 * Shënimi i ushqyerjes, në një kartë: Gji / Biberon / Ushqim.
 *
 * - Gji: dy rrathë, një për çdo gji. Prekja zgjedh gjirin (i sugjeruari është gati), "Nis" e ndez kohëmatësin. Gjatë
 *   ushqyerjes çdo gji ka orën e vet; prekja e tjetrit e ndërron, prekja e atij që po ecën bën pauzë. Pa kohëmatës:
 *   "Ka mbaruar tashmë?" e shënon me një prekje sipas kohëzgjatjes.
 * - Biberon: qumësht gjiri ose formulë, sasia me − / + ose me shifrat e shpejta (e fundit është gati).
 * - Ushqim: çipat e ushqimeve (të fundit të parët), disa njëherësh.
 * "Kur?" lejon shënimin e diçkaje që ndodhi para 15–60 minutash pa hapur formularin.
 */
export function FeedComposer({
  log,
  onLog,
  onDetails,
}: {
  log: FeedingEntry[];
  onLog: (entry: Partial<FeedingEntry>) => void;
  onDetails: (prefill: FeedPrefill) => void;
}) {
  const { t } = useTranslation();
  const themed = useToneTheme();
  // Teksti mbi ngjyrën e theksit: i bardhë në dritë, i errët natën (theksi zbardhet në temën e errët).
  const ON = useThemeColors().onAccent;

  // ---- Kohëmatësi i gjirit: ruhet te telefoni, mbijeton mbylljen e app-it dhe ndryshimet nga widget-i / nata ----
  const [timer, setTimer] = useState<BreastTimer | null>(null);
  const [endedOn, setEndedOn] = useState<Side | null>(null);
  const [tick, setTick] = useState(() => new Date());
  const ownWrites = useRef(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void loadTimer().then((v) => {
        if (!alive) return;
        setTimer(v);
        setTick(new Date());
      });
    load();
    void loadLastEnd().then((v) => alive && setEndedOn(v));
    // Ndryshimet e veta s'rilexohen (do ta kthenin mbrapsht ekranin për një çast kur prekjet janë të shpejta).
    const sub = DeviceEventEmitter.addListener(BREAST_TIMER_EVENT, () => {
      if (ownWrites.current > 0) ownWrites.current--;
      else load();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const running = !!timer && !isPaused(timer);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, [running]);

  function persist(next: BreastTimer | null) {
    setTimer(next);
    setTick(new Date());
    ownWrites.current++;
    void saveTimer(next);
  }

  // ---- Zgjedhjet ----
  const lastFeed = log.find((e) => e.type !== "water" && e.type !== "medicine");
  const [pickedTab, setPickedTab] = useState<Tab | null>(null);
  const tab: Tab = pickedTab ?? (timer ? "breast" : tabOf(lastFeed?.type));
  const tone = themed(TYPE_TONE[TAB_TYPE[tab]]);

  const lastBreast = log.find((e) => e.type === "breast");
  const lastSide = lastBreast?.side === "left" || lastBreast?.side === "right" ? lastBreast.side : null;
  const suggested = suggestedSide(lastBreast?.side, endedOn);
  const [pickedSide, setPickedSide] = useState<Side | null>(null);
  const side: Side = timer ? timer.side : pickedSide ?? suggested;

  const lastBottle = log.find((e) => e.type === "bottle" || e.type === "formula");
  const lastMl = log.find((e) => (e.type === "bottle" || e.type === "formula") && e.amountMl)?.amountMl ?? null;
  const [pickedMilk, setPickedMilk] = useState<Milk | null>(null);
  const milk: Milk = pickedMilk ?? (lastBottle?.type === "formula" ? "formula" : "bottle");
  const [pickedMl, setPickedMl] = useState<number | null>(null);
  const [mlText, setMlText] = useState<string | null>(null);
  const ml = pickedMl ?? lastMl ?? 90;

  const defaultFoods = useMemo(() => t("feeding_foods_default").split(",").map((s) => s.trim()).filter(Boolean), [t]);
  const [addedFoods, setAddedFoods] = useState<string[]>([]);
  const foods = useMemo(() => foodChoices([...addedFoods, ...recentFoods(log)], defaultFoods), [addedFoods, log, defaultFoods]);
  const [picks, setPicks] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const [ago, setAgo] = useState(0);

  // ---- Veprimet ----
  function pickTab(next: Tab) {
    if (next === tab) return;
    haptics.select();
    setPickedTab(next);
    setAgo(0);
  }

  function tapSide(s: Side) {
    if (!timer) {
      haptics.select();
      setPickedSide(s);
      return;
    }
    if (s === timer.side) return togglePause();
    haptics.select();
    persist(switchSide(timer, s));
  }
  function start() {
    haptics.tap();
    persist(startTimer(side));
  }
  function togglePause() {
    if (!timer) return;
    haptics.select();
    persist(isPaused(timer) ? resumeTimer(timer) : pauseTimer(timer));
  }
  function finish() {
    if (!timer) return;
    const done = finishTimer(timer);
    persist(null);
    setPickedSide(null);
    if (done.side === "both") {
      setEndedOn(done.endedOn);
      void saveLastEnd(done.endedOn);
    }
    const split =
      done.side === "both" && done.leftMin > 0 && done.rightMin > 0
        ? `${t("feeding_side_left")} ${done.leftMin} min · ${t("feeding_side_right")} ${done.rightMin} min`
        : null;
    onLog({ type: "breast", side: done.side, at: done.at, durationMin: done.durationMin, ...(split ? { note: split } : {}) });
  }
  function discard() {
    Alert.alert(t("feeding_timer_discard_q"), undefined, [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("feeding_timer_discard_yes"),
        style: "destructive",
        onPress: () => {
          haptics.select();
          persist(null);
        },
      },
    ]);
  }
  function logFinished(min: number) {
    onLog({ type: "breast", side, durationMin: min, at: minutesAgo(min) });
    setPickedSide(null);
  }

  function setAmount(next: number) {
    setPickedMl(Math.max(0, Math.min(MAX_ML, Math.round(next))));
    setMlText(null);
  }

  function toggleFood(food: string) {
    haptics.select();
    setPicks((cur) => (cur.includes(food) ? cur.filter((f) => f !== food) : [...cur, food]));
  }
  function addFood() {
    const food = draft.trim().slice(0, 40);
    setAdding(false);
    setDraft("");
    if (!food) return;
    const known = foods.find((f) => f.toLocaleLowerCase() === food.toLocaleLowerCase());
    if (!known) setAddedFoods((cur) => [food, ...cur]);
    setPicks((cur) => (cur.includes(known ?? food) ? cur : [...cur, known ?? food]));
  }

  function save() {
    const when = ago ? { at: minutesAgo(ago) } : {};
    if (tab === "bottle") onLog({ type: milk, amountMl: ml > 0 ? ml : null, ...when });
    else onLog({ type: "solid", foodCategory: picks.length ? picks.join(", ") : null, ...when });
    setAgo(0);
    setPicks([]);
    setPickedMl(null);
    setMlText(null);
  }

  function openDetails() {
    haptics.tap();
    if (tab === "bottle") onDetails({ type: milk, amountMl: ml > 0 ? ml : null });
    else if (tab === "solid") onDetails({ type: "solid", foodCategory: picks.length ? picks.join(", ") : null });
    else onDetails({ type: "breast", side });
  }

  const per = timer ? sideSeconds(timer, tick) : null;
  const total = timer ? elapsedSeconds(timer, tick) : 0;
  const sideLabel = (s: Side) => t(`feeding_side_${s}` as never);

  return (
    <View style={shadows.soft} className="rounded-xl3 border border-ink/10 bg-surface p-3">
      <TypeTabs
        tab={tab}
        onPick={pickTab}
        labels={{
          breast: timer ? formatElapsed(total) : t("feeding_type_breast"),
          bottle: t("feeding_type_bottle"),
          solid: t("feeding_tab_solid"),
        }}
        live={running}
      />

      <View className="px-1 pb-1 pt-4">
        {tab === "breast" && (
          <MotiView key="breast" from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 200 }}>
            <View className="flex-row justify-center" style={{ gap: 20 }}>
              {(["left", "right"] as const).map((s) => {
                const on = side === s;
                const caption = timer
                  ? undefined
                  : s === suggested
                    ? t("feeding_side_suggested")
                    : s === lastSide
                      ? t("feeding_side_last")
                      : undefined;
                return (
                  <SideCircle
                    key={s}
                    label={sideLabel(s)}
                    caption={caption}
                    time={per && (per[s] > 0 || on) ? formatElapsed(per[s]) : undefined}
                    on={on}
                    pulsing={running && on}
                    tone={tone}
                    onPress={() => tapSide(s)}
                  />
                );
              })}
            </View>

            {timer ? (
              <View className="mt-5 items-center">
                <Text className="font-bodyMedium text-[12px] uppercase" style={{ color: tone.tint, letterSpacing: 0.6 }}>
                  {isPaused(timer) ? t("feeding_timer_paused") : t("feeding_timer_running", { side: sideLabel(timer.side) })}
                </Text>
                <Text
                  className="mt-1 font-display text-[48px] leading-[56px] text-ink"
                  style={{ fontVariant: ["tabular-nums"], opacity: isPaused(timer) ? 0.55 : 1 }}
                  accessibilityLabel={`${t("feeding_timer_total")} ${formatElapsed(total)}`}
                >
                  {formatElapsed(total)}
                </Text>
                <Text className="mt-1 px-4 text-center font-body text-[12px] text-ink-soft">{t("feeding_timer_tap_hint")}</Text>

                <View className="mt-4 w-full flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={togglePause}
                    accessibilityRole="button"
                    style={{ minHeight: 58, borderColor: tone.tint, flex: 1 }}
                    className="flex-row items-center justify-center gap-2 rounded-2xl border-2 active:opacity-80"
                  >
                    {isPaused(timer) ? <Play size={18} color={tone.tint} strokeWidth={2.2} /> : <Pause size={18} color={tone.tint} strokeWidth={2.2} />}
                    <Text className="font-bodySemibold text-[15px]" style={{ color: tone.tint }}>
                      {isPaused(timer) ? t("feeding_resume") : t("feeding_pause")}
                    </Text>
                  </Pressable>
                  <PrimaryButton
                    label={total >= 30 ? `${t("save_action")} · ${Math.max(1, Math.round(total / 60))} min` : t("save_action")}
                    icon={<Check size={19} color={ON} strokeWidth={2.4} />}
                    tone={tone}
                    onPress={finish}
                    flex={1.4}
                  />
                </View>
                <Pressable onPress={discard} accessibilityRole="button" hitSlop={8} className="mt-3 px-4 py-1.5">
                  <Text className="font-bodyMedium text-[13px] text-ink-faint">{t("feeding_timer_discard")}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="mt-5">
                  <PrimaryButton
                    label={t("feeding_timer_start_side", { side: sideLabel(side) })}
                    icon={<Play size={18} color={ON} strokeWidth={2.4} fill={ON} />}
                    tone={tone}
                    onPress={start}
                  />
                </View>
                <View className="mt-5 border-t border-ink/10 pt-4">
                  <Text className="mb-2.5 font-bodyMedium text-[12.5px] text-ink-soft">{t("feeding_done_already")}</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {DONE_MIN.map((m) => (
                      <Chip key={m} label={`${m} min`} tone={tone} onPress={() => logFinished(m)} a11y={`${sideLabel(side)}, ${m} min`} />
                    ))}
                  </View>
                </View>
              </>
            )}
          </MotiView>
        )}

        {tab === "bottle" && (
          <MotiView key="bottle" from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 200 }}>
            <View className="flex-row self-center rounded-full bg-cream-soft p-1">
              {(["bottle", "formula"] as const).map((m) => {
                const on = milk === m;
                const mt = themed(TYPE_TONE[m]);
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      haptics.select();
                      setPickedMilk(m);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ minHeight: 38, backgroundColor: on ? mt.tint : "transparent" }}
                    className="items-center justify-center rounded-full px-4"
                  >
                    <Text className="font-bodySemibold text-[13px]" style={{ color: on ? ON : mt.tint }}>
                      {m === "bottle" ? t("feeding_milk_breast") : t("feeding_type_formula")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-4 flex-row items-center justify-center" style={{ gap: 14 }}>
              <RoundButton label="−10 ml" tone={tone} onPress={() => setAmount(stepMl(ml, -1))} disabled={ml <= 0}>
                <Minus size={22} color={tone.tint} strokeWidth={2.4} />
              </RoundButton>
              <View className="flex-row items-baseline justify-center">
                {/* Gjerësi e caktuar (3 shifra): pa të, në web fusha zgjatet dhe i nxjerr − / + jashtë ekranit. */}
                <TextInput
                  value={mlText ?? String(ml)}
                  onChangeText={(v) => {
                    const digits = v.replace(/[^0-9]/g, "").slice(0, 3);
                    setMlText(digits);
                    setPickedMl(Math.min(MAX_ML, Number(digits) || 0));
                  }}
                  onBlur={() => setMlText(null)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel={t("feeding_amount_ml_ph")}
                  className="font-display text-ink"
                  style={{ fontSize: 52, lineHeight: 62, width: 104, textAlign: "center", padding: 0, fontVariant: ["tabular-nums"] }}
                />
                <Text className="ml-1 font-bodySemibold text-[18px]" style={{ color: tone.tint }}>
                  ml
                </Text>
              </View>
              <RoundButton label="+10 ml" tone={tone} onPress={() => setAmount(stepMl(ml, 1))} disabled={ml >= MAX_ML}>
                <Plus size={22} color={tone.tint} strokeWidth={2.4} />
              </RoundButton>
            </View>

            <View className="mt-4 flex-row flex-wrap justify-center" style={{ gap: 8 }}>
              {quickAmounts(lastMl).map((a) => (
                <Chip
                  key={a}
                  label={String(a)}
                  a11y={`${a} ml`}
                  on={ml === a}
                  tone={tone}
                  onPress={() => {
                    haptics.select();
                    setAmount(a);
                  }}
                />
              ))}
            </View>
          </MotiView>
        )}

        {tab === "solid" && (
          <MotiView key="solid" from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 200 }}>
            <Text className="mb-2.5 font-bodyMedium text-[12.5px] text-ink-soft">{t("feeding_foods_title")}</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {foods.map((f) => (
                <Chip key={f} label={f} on={picks.includes(f)} tone={tone} onPress={() => toggleFood(f)} />
              ))}
              {!adding && (
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    setAdding(true);
                  }}
                  accessibilityRole="button"
                  style={{ minHeight: 40, borderColor: tone.tint }}
                  className="flex-row items-center justify-center gap-1 rounded-full border border-dashed px-3.5"
                >
                  <Plus size={14} color={tone.tint} strokeWidth={2.4} />
                  <Text className="font-bodySemibold text-[13.5px]" style={{ color: tone.tint }}>
                    {t("feeding_food_other")}
                  </Text>
                </Pressable>
              )}
            </View>
            {adding && (
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                // "Done" e mbyll tastierën (blurOnSubmit), kështu ruajtja bëhet një herë, te onBlur.
                onBlur={addFood}
                returnKeyType="done"
                placeholder={t("feeding_food_add_ph")}
                placeholderClassName="text-ink-faint"
                accessibilityLabel={t("feeding_food_add_ph")}
                className="mt-3 rounded-2xl border border-ink/10 bg-cream-soft px-4 py-3 font-body text-[15px] text-ink"
                style={{ minHeight: 48 }}
              />
            )}
          </MotiView>
        )}

        {tab !== "breast" && (
          <>
            <Text className="mb-2 mt-5 font-bodyMedium text-[12.5px] text-ink-soft">{t("feeding_when")}</Text>
            {/* Një shirit i vetëm me pjesë të barabarta: "Tani", sa më parë, ose ora e saktë te formulari. */}
            <View className="flex-row rounded-2xl bg-cream-soft p-1" accessibilityRole="radiogroup">
              {WHEN_AGO.map((m) => {
                const on = ago === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      haptics.select();
                      setAgo(m);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m === 0 ? t("feeding_when_now") : t("feeding_when_ago", { d: durationLabel(m, t) })}
                    style={{ minHeight: 40, backgroundColor: on ? tone.tint : "transparent" }}
                    className="flex-1 items-center justify-center rounded-xl"
                  >
                    <Text className="font-bodySemibold text-[12.5px]" style={{ color: on ? ON : tone.tint }} numberOfLines={1}>
                      {m === 0 ? t("feeding_when_now") : `−${compactDuration(m)}`}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={openDetails}
                accessibilityRole="button"
                accessibilityLabel={t("feeding_when_other")}
                style={{ minHeight: 40 }}
                className="flex-1 items-center justify-center rounded-xl"
              >
                <Text className="font-bodySemibold text-[12.5px] text-ink-soft" numberOfLines={1}>
                  {t("feeding_when_other")}
                </Text>
              </Pressable>
            </View>
            <View className="mt-4">
              <PrimaryButton
                label={
                  tab === "bottle"
                    ? ml > 0
                      ? `${t("save_action")} · ${ml} ml`
                      : t("save_action")
                    : picks.length
                      ? `${t("save_action")} · ${picks.slice(0, 2).join(", ")}${picks.length > 2 ? "…" : ""}`
                      : t("save_action")
                }
                icon={<Check size={19} color={ON} strokeWidth={2.4} />}
                tone={tone}
                onPress={save}
              />
            </View>
          </>
        )}

        <Pressable onPress={() => onDetails({})} accessibilityRole="button" className="mt-3 flex-row items-center justify-center gap-1.5 py-2">
          <Icon name="plus" size={14} color="#6B6154" />
          <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("feeding_more_types")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Tri skedat me treguesin që rrëshqet nën to dhe merr ngjyrën e llojit. */
function TypeTabs({ tab, onPick, labels, live }: { tab: Tab; onPick: (t: Tab) => void; labels: Record<Tab, string>; live: boolean }) {
  const themed = useToneTheme();
  const ON = useThemeColors().onAccent;
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - 8) / TABS.length : 0;
  const index = TABS.indexOf(tab);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="flex-row rounded-2xl bg-cream-soft p-1"
      accessibilityRole="tablist"
    >
      {slot > 0 && (
        <MotiView
          animate={{ translateX: index * slot, backgroundColor: themed(TYPE_TONE[TAB_TYPE[tab]]).tint }}
          transition={{ type: "spring", damping: 20, stiffness: 240, mass: 0.8 }}
          style={[shadows.press, { position: "absolute", top: 4, bottom: 4, left: 4, width: slot, borderRadius: 13 }]}
        />
      )}
      {TABS.map((tb) => {
        const on = tab === tb;
        const tone = themed(TYPE_TONE[TAB_TYPE[tb]]);
        return (
          <Pressable
            key={tb}
            onPress={() => onPick(tb)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ minHeight: 48 }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl"
          >
            {tb === "breast" && live ? (
              <MotiView
                from={{ opacity: 1 }}
                animate={{ opacity: 0.25 }}
                transition={{ type: "timing", duration: 700, loop: true, repeatReverse: true }}
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? ON : tone.tint }}
              />
            ) : (
              <Icon name={TYPE_ICON[TAB_TYPE[tb]]} size={15} color={on ? ON : tone.tint} />
            )}
            <Text
              className="font-bodySemibold text-[13.5px]"
              style={{ color: on ? ON : tone.tint, fontVariant: ["tabular-nums"] }}
              numberOfLines={1}
            >
              {labels[tb]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rrethi i një gjiri: i zgjedhuri me ngjyrë të plotë; ai që po ecën pulson butë. */
function SideCircle({
  label,
  caption,
  time,
  on,
  pulsing,
  tone,
  onPress,
}: {
  label: string;
  caption?: string;
  time?: string;
  on: boolean;
  pulsing: boolean;
  tone: ThemedTone;
  onPress: () => void;
}) {
  const ON = useThemeColors().onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, time, caption].filter(Boolean).join(", ")}
      accessibilityState={{ selected: on }}
      style={{ width: CIRCLE, height: CIRCLE }}
      className="items-center justify-center"
    >
      {pulsing && (
        <MotiView
          from={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.2 }}
          transition={{ type: "timing", duration: 1500, loop: true, repeatReverse: false }}
          style={{ position: "absolute", width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: tone.tint }}
        />
      )}
      <MotiView
        animate={{ scale: on ? 1 : 0.92 }}
        transition={{ type: "spring", damping: 16, stiffness: 220 }}
        style={[
          on ? shadows.soft : null,
          {
            width: CIRCLE,
            height: CIRCLE,
            borderRadius: CIRCLE / 2,
            backgroundColor: on ? tone.tint : tone.tintBg,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text className="font-bodySemibold text-[15px]" style={{ color: on ? ON : tone.tint }}>
          {label}
        </Text>
        {time ? (
          <Text className="mt-0.5 font-display text-[22px] leading-[28px]" style={{ color: on ? ON : tone.ink, fontVariant: ["tabular-nums"] }}>
            {time}
          </Text>
        ) : null}
        {caption ? (
          <Text className="mt-1 font-body text-[11.5px]" style={{ color: on ? ON : tone.inkSoft, opacity: on ? 0.88 : 1 }}>
            {caption}
          </Text>
        ) : null}
      </MotiView>
    </Pressable>
  );
}

function Chip({
  label,
  on,
  tone,
  onPress,
  a11y,
  small,
}: {
  label: string;
  on?: boolean;
  tone: ThemedTone;
  onPress: () => void;
  a11y?: string;
  small?: boolean;
}) {
  const ON = useThemeColors().onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={on != null ? { selected: on } : undefined}
      style={{ minHeight: small ? 36 : 42, backgroundColor: on ? tone.tint : tone.tintBg }}
      className={`items-center justify-center rounded-full active:opacity-80 ${small ? "px-3" : "px-4"}`}
    >
      <Text className={`font-bodySemibold ${small ? "text-[12.5px]" : "text-[14px]"}`} style={{ color: on ? ON : tone.tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RoundButton({
  children,
  label,
  tone,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  tone: ThemedTone;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: tone.tintBg, opacity: disabled ? 0.4 : 1 }}
      className="items-center justify-center active:opacity-70"
    >
      {children}
    </Pressable>
  );
}

function PrimaryButton({
  label,
  icon,
  tone,
  onPress,
  flex,
}: {
  label: string;
  icon: React.ReactNode;
  tone: ThemedTone;
  onPress: () => void;
  flex?: number;
}) {
  const ON = useThemeColors().onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[shadows.soft, { minHeight: 58, backgroundColor: tone.tint, flex }]}
      className="flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-85"
    >
      {icon}
      <Text className="font-bodySemibold text-[16px]" style={{ color: ON }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
