import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { dayKey, MOOD_EMOJI, needsSupport, saveCheckin, skipCheckinToday, tipKeyFor, useCheckins, type Mood } from "@/lib/parent/checkin";

const MOODS: Mood[] = [1, 2, 3, 4, 5];

/** Rreshti me 5 emoji: secili 56dp, që preket lehtë edhe me bebin në krah. */
export function MoodRow({ value, onPick }: { value: Mood | null; onPick: (m: Mood) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {MOODS.map((m) => (
        <Pressable
          key={m}
          onPress={() => {
            haptics.select();
            onPick(m);
          }}
          accessibilityRole="button"
          accessibilityLabel={t(`ci_mood_${m}` as never)}
          accessibilityState={{ selected: value === m }}
          className="flex-1 items-center justify-center rounded-2xl"
          style={{ minHeight: 56, backgroundColor: value === m ? TONES.green.tintBg : "rgba(23,33,43,0.05)" }}
        >
          <Text style={{ fontSize: 26 }}>{MOOD_EMOJI[m]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Kutia e ngrohtë pas disa ditësh të rënda: ndihmë, jo alarm. */
export function SupportBox() {
  const { t } = useTranslation();
  return (
    <View className="mt-3 rounded-2xl p-3.5" style={{ backgroundColor: TONES.pink.tintBg }}>
      <Text className="font-bodySemibold text-[14px]" style={{ color: "#17212B" }}>
        {t("ci_support_title")}
      </Text>
      <Text className="mt-1 font-body text-[13px] leading-5" style={{ color: "#3B4652" }}>
        {t("ci_support_body")}
      </Text>
      <Pressable
        onPress={() => router.push("/community/explore")}
        accessibilityRole="button"
        className="mt-3 items-center justify-center rounded-full px-4"
        style={{ minHeight: 48, backgroundColor: "#17212B" }}
      >
        <Text className="font-bodySemibold text-[14px]" style={{ color: "#FFF8EF" }}>
          {t("ci_support_expert")}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * "Si je sot?" te faqja e bebit: një herë në ditë, me "Jo sot". Pas
 * përgjigjes: një këshillë e vogël, dhe kur ditët janë të rënda, ndihmë.
 */
export function CheckInCard({ parentName }: { parentName: string | null }) {
  const { t } = useTranslation();
  const { list, prefs, loaded } = useCheckins();
  if (!loaded || !prefs.enabled) return null;
  const today = dayKey(new Date());
  if (prefs.skippedDay === today) return null;
  const entry = list.find((c) => c.day === today) ?? null;
  const name = parentName?.trim().split(" ")[0];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 220 }}
      style={shadows.soft}
      className="mt-5 rounded-xl3 bg-surface p-4"
    >
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="heart" size={15} color={TONES.pink.tint} />
        <Text className="flex-1 font-bodySemibold text-base text-ink">{name ? t("ci_title_named", { name }) : t("ci_title")}</Text>
        <Pressable
          onPress={() => {
            haptics.select();
            skipCheckinToday();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={entry ? t("close_action") : t("ci_not_today")}
        >
          {entry ? <Icon name="close" size={15} color="#8A929A" /> : <Text className="font-bodyMedium text-[13px] text-ink-faint">{t("ci_not_today")}</Text>}
        </Pressable>
      </View>
      <Text className="mb-3 font-body text-xs text-ink-soft">{t("ci_private")}</Text>

      <MoodRow value={entry?.mood ?? null} onPick={(m) => saveCheckin(m)} />

      {entry ? (
        <>
          <Text className="mt-3 font-bodyMedium text-[14px] leading-5 text-ink">{t(tipKeyFor(entry.mood, entry.day))}</Text>
          {needsSupport(list) ? <SupportBox /> : null}
          <Pressable onPress={() => router.push("/(main)/baby/parent-care")} accessibilityRole="button" className="mt-2 flex-row items-center py-2" style={{ minHeight: 44 }}>
            <Text className="font-bodySemibold text-[13px] text-olive">{t("ci_more")}</Text>
            <Icon name="chevronRight" size={14} color="#6E7452" />
          </Pressable>
        </>
      ) : null}
    </MotiView>
  );
}
