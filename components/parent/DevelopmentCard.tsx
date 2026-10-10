import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { loadDevelopmentWeek, weekOfLife, type DevelopmentWeek } from "@/lib/parent/development";

/**
 * "Këtë javë": çfarë po mëson bebi sipas javës së jetës dhe 3 ide loje.
 * Përmbajtja vjen nga paneli (tabela development_weeks), ndaj ndryshon pa
 * përditësim të app-it.
 */
export function DevelopmentCard({ babyDob }: { babyDob: string | null }) {
  const { t, lang } = useTranslation();
  const week = weekOfLife(babyDob);
  const [content, setContent] = useState<{ key: string; week: DevelopmentWeek | null } | null>(null);
  const key = `${lang}:${week}`;

  useEffect(() => {
    if (week === null) return;
    let alive = true;
    void loadDevelopmentWeek(week, lang === "en" ? "en" : "sq").then((w) => alive && setContent({ key, week: w }));
    return () => {
      alive = false;
    };
  }, [week, lang, key]);

  const w = content?.key === key ? content.week : null;
  if (week === null || !w) return null;

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="sparkle" size={15} color={TONES.green.tint} />
        <Text className="flex-1 font-bodyMedium text-[12.5px] text-ink-soft">{t("dev_week_label", { n: week + 1 })}</Text>
      </View>
      <Text className="font-bodySemibold text-[17px] text-ink">{t("dev_this_week", { title: w.title })}</Text>
      <Text className="mt-1 font-body text-[13.5px] leading-5 text-ink-soft">{w.body}</Text>
      <Text className="mb-1.5 mt-3 font-bodySemibold text-[13px] text-ink">{t("dev_play_ideas")}</Text>
      {w.ideas.slice(0, 3).map((idea, i) => (
        <View key={i} className="flex-row items-start py-1">
          <View className="mr-2.5 mt-0.5 h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: TONES.green.tintBg }}>
            <Text className="font-bodySemibold text-[11px]" style={{ color: TONES.green.tint }}>
              {i + 1}
            </Text>
          </View>
          <Text className="flex-1 font-body text-[13.5px] leading-5 text-ink">{idea}</Text>
        </View>
      ))}
      <Text className="mt-2 font-body text-[11px] text-ink-faint">{t("dev_own_pace")}</Text>
    </View>
  );
}
