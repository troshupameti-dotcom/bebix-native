import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { logWarn } from "@/lib/log";
import { CARD_PREVIEW, fetchAnswers, fetchTodayQuestion, type DailyAnswer, type DailyQuestion } from "@/lib/community/dailyQuestion";

type Loaded = { question: DailyQuestion; answers: DailyAnswer[]; total: number; mine: DailyAnswer | null };

/**
 * "Pyetja e ditës" në krye të Komunitetit: pyetja, sa prindër janë
 * përgjigjur, 3 përgjigjet e para dhe "Përgjigju". Pa pyetje për sot, s'shfaqet.
 * `refreshKey` ndryshon kur prindi tërheq poshtë ose kthehet te skeda.
 */
export function DailyQuestionCard({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const question = await fetchTodayQuestion(language === "en" ? "en" : "sq");
        if (!question) {
          if (alive) setData(null);
          return;
        }
        const { answers, total, mine } = await fetchAnswers(question.id, CARD_PREVIEW);
        if (alive) setData({ question, answers, total, mine });
      } catch (err) {
        // Pa internet ose pa migrimin: karta thjesht s'shfaqet; Komuniteti vazhdon.
        logWarn("Daily question load error:", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey, language]);

  if (!data) return null;
  const { question, answers, total, mine } = data;
  const open = (compose: boolean) => {
    haptics.tap();
    router.push({ pathname: "/community/question/[id]", params: { id: question.id, ...(compose ? { compose: "1" } : {}) } });
  };

  return (
    <View style={shadows.soft} className="mx-5 mt-4 rounded-xl2 bg-surface p-4">
      <View className="mb-2 flex-row items-center">
        <Icon name="comment" size={14} color={theme.olive} />
        <Text className="ml-1.5 flex-1 font-bodyMedium text-[10px] tracking-wide text-ink-faint">{t("dq_label").toUpperCase()}</Text>
        <Text className="font-body text-[11px] text-ink-faint">
          {total === 1 ? t("dq_count_one") : t("dq_count", { n: total })}
        </Text>
      </View>

      <Pressable onPress={() => open(false)} accessibilityRole="button">
        <Text className="font-bodySemibold text-[15px] leading-6 text-ink">{question.text}</Text>
      </Pressable>

      {answers.length > 0 ? (
        <View className="mt-3" style={{ gap: 8 }}>
          {answers.map((a) => (
            <View key={a.id} className="rounded-xl bg-cream-soft px-3 py-2">
              <View className="mb-0.5 flex-row flex-wrap items-center" style={{ gap: 6 }}>
                <Text className="font-bodySemibold text-xs text-ink">{a.authorName}</Text>
                {a.expert ? <ExpertBadge specialty={a.expert.specialty} kind={a.expert.kind} compact /> : null}
              </View>
              <Text className="font-body text-[13px] leading-5 text-ink-soft" numberOfLines={2}>
                {a.text}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-2 font-body text-xs text-ink-soft">{t("dq_be_first")}</Text>
      )}

      <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
        <Pressable
          onPress={() => open(true)}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center rounded-full bg-olive px-4"
          style={{ minHeight: 44 }}
        >
          <Text className="font-bodySemibold text-sm text-on-accent">{mine ? t("dq_edit_answer") : t("dq_answer")}</Text>
        </Pressable>
        {total > 0 ? (
          <Pressable
            onPress={() => open(false)}
            accessibilityRole="button"
            className="items-center justify-center rounded-full bg-cream-soft px-4"
            style={{ minHeight: 44 }}
          >
            <Text className="font-bodyMedium text-sm text-ink">{t("dq_see_all")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
