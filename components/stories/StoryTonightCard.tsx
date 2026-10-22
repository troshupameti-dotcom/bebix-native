import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { BookOpen, ChevronRight } from "lucide-react-native";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { useStoryMeta } from "@/components/stories/StoryParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { shadows } from "@/lib/shadows";
import { storyOfTheDay } from "@/lib/stories/catalog";
import { useStoryIndex } from "@/lib/stories/useStoryIndex";

/** "Përrallë për sonte" te kreu: një përrallë e ditës për moshën e fëmijës, dhe hyrja te biblioteka. */
export function StoryTonightCard({ months }: { months: number | null }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  const { stories } = useStoryIndex();
  const story = useMemo(() => storyOfTheDay(stories, months), [stories, months]);
  if (!story) return null;

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <BookOpen size={15} color={c.olive} />
        <Text className="flex-1 font-bodySemibold text-base text-ink">{t("stories_tonight")}</Text>
        <Pressable
          onPress={() => router.push("/(main)/baby/stories")}
          accessibilityRole="button"
          hitSlop={10}
          className="flex-row items-center gap-0.5"
        >
          <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("stories_all")}</Text>
          <ChevronRight size={15} color={c.inkSoft} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push({ pathname: "/(main)/baby/stories/[slug]", params: { slug: story.slug } })}
        accessibilityRole="button"
        accessibilityLabel={`${t("stories_tonight")}: ${story.title}. ${meta.minutes(story)}`}
        className="flex-row items-center gap-4 pl-1"
      >
        <StoryBookCover story={story} width={62} showTitle={false} />
        <View className="flex-1">
          <Text className="font-bodySemibold text-[15px] leading-5 text-ink" numberOfLines={2}>
            {story.title}
          </Text>
          <Text className="mt-0.5 font-body text-[12.5px] leading-[17px] text-ink-soft" numberOfLines={2}>
            {story.summary}
          </Text>
          <Text className="mt-1 font-body text-[11.5px] text-ink-faint">
            {meta.minutes(story)} · {meta.ages(story)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
