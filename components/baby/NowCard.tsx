import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon, type IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { sinceLabel, type LiveStatus } from "@/lib/baby/dayStats";

/**
 * "Tani" — gjendja e çastit dhe tre veprimet që ndodhin disa herë në ditë.
 *
 * Kjo zëvendëson faqen e vjetër kryesore: aty ishin të njëjtat gjëra, por
 * një tab larg nga bebi, dhe të përziera me produkte e banderola.
 *
 * Gjumi ndizet e fiket këtu, sepse "nisi/mbaroi" nuk ka asgjë për të
 * plotësuar. Ushqyerja dhe pelena hapin ekranin e vet: ato kanë detaje që
 * s'duhen hamendësuar për prindin.
 */

type Props = {
  status: LiveStatus;
  onToggleSleep: () => void;
  now?: Date;
};

function Action({
  icon, label, sub, tone, onPress,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  tone: "olive" | "quiet";
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const isOlive = tone === "olive";
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={shadows.soft}
      className={`flex-1 items-center rounded-xl2 py-3.5 ${isOlive ? "bg-olive" : "bg-surface"}`}
    >
      <Icon name={icon} size={20} color={isOlive ? theme.onAccent : theme.inkSoft} />
      <Text className={`font-bodyMedium text-xs mt-1.5 ${isOlive ? "text-on-accent" : "text-ink"}`}>{label}</Text>
      {sub ? (
        <Text className={`font-body text-[10px] mt-0.5 ${isOlive ? "text-on-accent/70" : "text-ink-faint"}`}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function NowCard({ status, onToggleSleep, now = new Date() }: Props) {
  const { t } = useTranslation();
  const asleep = status.asleepSince !== null;
  const sleepSince = sinceLabel(status.asleepSince, t, now);
  const awakeSince = sinceLabel(status.awakeSince, t, now);
  const feedingSince = sinceLabel(status.lastFeedingAt, t, now);
  const diaperSince = sinceLabel(status.lastDiaperAt, t, now);

  const headline = asleep
    ? t("now_asleep_for", { t: sleepSince ?? "" })
    : awakeSince
      ? t("now_awake_for", { t: awakeSince })
      : t("now_no_sleep");

  return (
    <View style={shadows.soft} className="bg-surface rounded-xl3 p-4 mt-5">
      <View className="flex-row items-center mb-3">
        <View className={`w-2.5 h-2.5 rounded-full mr-2 ${asleep ? "bg-olive" : "bg-orange"}`} />
        <Text className="font-bodySemibold text-base text-ink flex-1">{headline}</Text>
      </View>

      <View className="flex-row mb-4">
        <Text className="font-body text-xs text-ink-soft flex-1">
          {t("now_last_feeding")} <Text className="font-bodyMedium text-ink">{feedingSince ?? "—"}</Text>
        </Text>
        <Text className="font-body text-xs text-ink-soft flex-1">
          {t("now_last_diaper")} <Text className="font-bodyMedium text-ink">{diaperSince ?? "—"}</Text>
        </Text>
      </View>

      <View className="flex-row" style={{ gap: 10 }}>
        <Action
          icon="spoon"
          label={t("qa_feeding_label")}
          tone="quiet"
          onPress={() => router.push("/(main)/baby/feeding")}
        />
        <Action
          icon="moon"
          label={asleep ? t("now_wake") : t("qa_sleep_label")}
          sub={asleep ? sleepSince ?? undefined : undefined}
          tone={asleep ? "olive" : "quiet"}
          onPress={onToggleSleep}
        />
        <Action
          icon="diaper"
          label={t("qa_diaper_label")}
          tone="quiet"
          onPress={() => router.push("/(main)/baby/diaper")}
        />
      </View>
    </View>
  );
}
