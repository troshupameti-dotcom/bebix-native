import { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { compareWithYesterday, deltaLabel, durationLabel } from "@/lib/baby/dayStats";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

function Stat({ icon, tone, label, value, delta }: { icon: IconName; tone: Tone; label: string; value: string; delta: string | null }) {
  return (
    <View className="flex-1 items-center rounded-2xl px-1 py-3" style={{ backgroundColor: tone.tintBg }} accessible accessibilityLabel={`${label}: ${value}${delta ? `, ${delta}` : ""}`}>
      <Icon name={icon} size={16} color={tone.tint} />
      <Text className="mt-1 font-bodyMedium text-[11.5px]" style={{ color: tone.tint }}>
        {label}
      </Text>
      <Text className="mt-0.5 font-display text-[20px]" style={{ color: "#17212B" }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta ? (
        <Text className="mt-0.5 text-center font-body text-[10.5px]" style={{ color: "#5C6670" }} numberOfLines={1} adjustsFontSizeToFit>
          {delta}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * "Sot" në krye të faqes së bebit: ushqimet, pelenat dhe gjumi që nga
 * mesnata, krahasuar me dje në të njëjtën orë. Llogaritet nga listat në
 * memorie (pa thirrje në rrjet), ndaj ndryshon sapo shënohet diçka; çdo
 * minutë rifreskohet edhe për gjumin që po vazhdon.
 */
export function DaySummaryCard({ feedings, sleeps, diapers }: { feedings: FeedingEntry[]; sleeps: SleepEntry[]; diapers: DiaperEntry[] }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  // Ora e çastit, jo ajo e minutës së fundit: një shënim i ri numërohet menjëherë.
  // `now` (çdo minutë) e rillogarit edhe për gjumin që po vazhdon.
  const { today, delta } = useMemo(
    () => compareWithYesterday(feedings, sleeps, diapers, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedings, sleeps, diapers, now]
  );
  const empty = today.feedings === 0 && today.diapers === 0 && today.sleepMinutes === 0;

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <Text className="mb-3 font-bodySemibold text-base text-ink">{t("sum_title")}</Text>
      {empty ? (
        <Text className="font-body text-[13.5px] leading-5 text-ink-soft">{t("sum_empty")}</Text>
      ) : (
        <>
          <View className="flex-row" style={{ gap: 8 }}>
            <Stat
              icon="spoon"
              tone={TONES.pink}
              label={t("sum_feedings")}
              value={String(today.feedings)}
              delta={delta.feedings === null ? null : deltaLabel(delta.feedings, "count", t)}
            />
            <Stat
              icon="diaper"
              tone={TONES.blue}
              label={t("sum_diapers")}
              value={String(today.diapers)}
              delta={delta.diapers === null ? null : deltaLabel(delta.diapers, "count", t)}
            />
            <Stat
              icon="moon"
              tone={TONES.purple}
              label={t("sum_sleep")}
              value={today.sleepMinutes > 0 ? durationLabel(today.sleepMinutes, t) : "0"}
              delta={delta.sleepMinutes === null ? null : deltaLabel(delta.sleepMinutes, "minutes", t)}
            />
          </View>
          {delta.feedings !== null || delta.diapers !== null || delta.sleepMinutes !== null ? (
            <Text className="mt-2 font-body text-[11px] text-ink-faint">{t("sum_compare_note")}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
