import { useMemo, useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useMomentUri } from "@/lib/baby/useMomentUri";
import { onThisDay, recapMonthToShow, type MemoryAgo } from "@/lib/baby/memories";
import { exportFirstYearBook } from "@/lib/export";
import type { BabyModuleState, Moment } from "@/lib/state/babyTypes";
import type { BabyProfile } from "@/lib/state/types";
import type { TranslationKey } from "@/lib/i18n/translations";

function agoLabel(ago: MemoryAgo, t: (k: TranslationKey, p?: Record<string, string | number>) => string): string {
  if (ago.months % 12 === 0) {
    const years = ago.months / 12;
    return years === 1 ? t("memories_ago_year_one") : t("memories_ago_years", { n: years });
  }
  return ago.months === 1 ? t("memories_ago_month_one") : t("memories_ago_months", { n: ago.months });
}

function Thumb({ moment }: { moment: Moment }) {
  const uri = useMomentUri(moment);
  return (
    <View className="h-20 flex-1 overflow-hidden rounded-2xl bg-cream-soft">
      {uri && moment.type === "photo" ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <View className="flex-1 items-center justify-center px-2">
          <Text className="text-center font-bodyMedium text-[11px] text-ink-soft" numberOfLines={3}>
            {moment.title || "💛"}
          </Text>
        </View>
      )}
    </View>
  );
}

function LinkRow({ icon, tone, title, sub, onPress, busy }: { icon: IconName; tone: Tone; title: string; sub: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" className="flex-row items-center gap-3 py-2.5" style={{ minHeight: 52 }}>
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: tone.tintBg }}>
        <Icon name={icon} size={16} color={tone.tint} />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-[14px] text-ink">{title}</Text>
        <Text className="font-body text-xs text-ink-soft">{sub}</Text>
      </View>
      {busy ? <ActivityIndicator size="small" /> : <Icon name="chevronRight" size={16} color={tone.tint} />}
    </Pressable>
  );
}

/**
 * "Kujtimet" te faqja e bebit: sot para 1 muaji / 6 muajsh / 1 viti, filmi
 * i muajit të kaluar (1–7 të muajit), kapsula e kohës dhe libri i vitit të parë.
 */
export function MemoriesCard({ baby, profile, babyName }: { baby: BabyModuleState; profile: BabyProfile; babyName: string }) {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const [bookBusy, setBookBusy] = useState(false);

  const today = useMemo(() => onThisDay(baby.moments)[0] ?? null, [baby.moments]);
  const recap = useMemo(() => recapMonthToShow(baby), [baby]);
  const monthName = recap
    ? new Date(recap.start).toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { month: "long" })
    : "";

  async function makeBook() {
    haptics.tap();
    setBookBusy(true);
    try {
      await exportFirstYearBook(profile, baby, lang === "en" ? "en" : "sq", babyName);
    } catch {
      showToast(t("book_error"));
    } finally {
      setBookBusy(false);
    }
  }

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="heart" size={15} color={TONES.pink.tint} />
        <Text className="font-bodySemibold text-base text-ink">{t("memories_title")}</Text>
      </View>

      {today ? (
        <Pressable
          onPress={() => router.push("/(main)/baby/moments")}
          accessibilityRole="button"
          accessibilityLabel={t("memories_on_this_day", { ago: agoLabel(today.ago, t) })}
          className="mb-2 mt-2"
        >
          <Text className="mb-2 font-bodyMedium text-[13px] text-ink-soft">{t("memories_on_this_day", { ago: agoLabel(today.ago, t) })}</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {today.moments.slice(0, 3).map((m) => (
              <Thumb key={m.id} moment={m} />
            ))}
          </View>
        </Pressable>
      ) : null}

      {recap ? (
        <LinkRow
          icon="play"
          tone={TONES.purple}
          title={t("month_recap_title", { month: monthName })}
          sub={t("month_recap_sub")}
          onPress={() => router.push({ pathname: "/(main)/baby/month-recap", params: { month: recap.month } })}
        />
      ) : null}
      <LinkRow
        icon="lock"
        tone={TONES.amber}
        title={t("capsule_title")}
        sub={t("capsule_sub")}
        onPress={() => router.push("/(main)/baby/time-capsule")}
      />
      <LinkRow icon="download" tone={TONES.blue} title={t("book_title")} sub={t("book_sub")} onPress={makeBook} busy={bookBusy} />
    </View>
  );
}
