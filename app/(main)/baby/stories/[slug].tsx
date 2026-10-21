import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, Clock, Heart, RotateCcw } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { StoryCover } from "@/components/stories/StoryCover";
import { CATEGORY_META, useStoryMeta } from "@/components/stories/StoryParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { loadStory } from "@/lib/stories/api";
import { toggleFavorite, useStoryUserData } from "@/lib/stories/userData";
import type { Story } from "@/lib/stories/types";

type State = { kind: "loading" } | { kind: "ready"; story: Story } | { kind: "missing" } | { kind: "error" };

/** Faqja e një përralle: ilustrimi, koha e leximit, mosha, kategoritë, përshkrimi, dhe "Lexo" / "Vazhdo". */
export default function StoryDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  const user = useStoryUserData();
  const [state, setState] = useState<State>({ kind: "loading" });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (slug ? loadStory(String(slug)) : Promise.resolve(null)).then(
      (story) => alive && setState(story ? { kind: "ready", story } : { kind: "missing" }),
      () => alive && setState({ kind: "error" })
    );
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  const story = state.kind === "ready" ? state.story : null;
  const progress = story ? user.progressOf(story.slug) : null;
  const pages = story?.paragraphs.length ?? 0;
  const resumePage = progress && !progress.finished && progress.page > 0 && progress.page < pages ? progress.page : 0;
  const favorite = story ? user.isFavorite(story.slug) : false;

  const read = (page: number) => {
    if (!story) return;
    haptics.tap();
    router.push({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: story.slug, page: String(page) } });
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <BackButton fallback="/(main)/baby/stories" />
        {story ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              toggleFavorite(story.slug, user.userId);
            }}
            accessibilityRole="button"
            accessibilityLabel={favorite ? t("stories_favorite_remove") : t("stories_favorite_add")}
            accessibilityState={{ selected: favorite }}
            className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-surface"
          >
            <Heart size={19} color={favorite ? c.orange : c.inkSoft} fill={favorite ? c.orange : "transparent"} />
          </Pressable>
        ) : null}
      </View>

      {state.kind === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.inkSoft} accessibilityLabel={t("stories_loading")} />
        </View>
      ) : state.kind !== "ready" || !story ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-bodySemibold text-[15px] text-ink">
            {state.kind === "missing" ? t("stories_not_found") : t("stories_load_error")}
          </Text>
          <Pressable
            onPress={() => (state.kind === "missing" ? router.replace("/(main)/baby/stories") : retry())}
            accessibilityRole="button"
            className="mt-4 justify-center rounded-full bg-ink px-5"
            style={{ minHeight: 44 }}
          >
            <Text className="font-bodyMedium text-[13px] text-cream">{state.kind === "missing" ? t("stories_back_to_library") : t("stories_retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <StoryCover story={story} style={{ width: "100%", aspectRatio: 4 / 3 }} radius={26} />
            <Text className="mt-5 font-display text-[26px] leading-8 text-ink" accessibilityRole="header">
              {story.title}
            </Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <View className="flex-row items-center gap-1.5">
                <Clock size={14} color={c.inkSoft} />
                <Text className="font-body text-[13px] text-ink-soft">{t("stories_reading_time", { n: story.readingMinutes })}</Text>
              </View>
              <Text className="font-body text-[13px] text-ink-soft">{meta.ages(story)}</Text>
              <Text className="font-body text-[13px] text-ink-soft">{t("stories_pages", { n: pages })}</Text>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {story.categories.map((cat) => {
                const Glyph = CATEGORY_META[cat].icon;
                return (
                  <View key={cat} className="flex-row items-center gap-1.5 rounded-full bg-cream-soft px-3 py-1.5">
                    <Glyph size={13} color={c.inkSoft} />
                    <Text className="font-bodyMedium text-xs text-ink-soft">{t(CATEGORY_META[cat].label)}</Text>
                  </View>
                );
              })}
            </View>
            <Text className="mt-4 font-body text-[15.5px] leading-6 text-ink">{story.summary}</Text>
            {progress ? (
              <Text className="mt-4 font-body text-[13px] text-ink-faint">
                {progress.finished ? t("stories_finished") : t("stories_page_of", { n: progress.page + 1, total: pages })}
              </Text>
            ) : null}
          </ScrollView>

          <View className="gap-2 border-t border-ink/10 px-5 pb-2 pt-3">
            <Pressable
              onPress={() => read(resumePage)}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2 rounded-full bg-ink"
              style={{ minHeight: 50 }}
            >
              <BookOpen size={18} color={c.cream} />
              <Text className="font-bodySemibold text-[15px] text-cream">
                {resumePage > 0 ? t("stories_continue", { n: resumePage + 1 }) : progress?.finished ? t("stories_read_again") : t("stories_read")}
              </Text>
            </Pressable>
            {resumePage > 0 ? (
              <Pressable onPress={() => read(0)} accessibilityRole="button" className="flex-row items-center justify-center gap-2" style={{ minHeight: 44 }}>
                <RotateCcw size={15} color={c.inkSoft} />
                <Text className="font-bodyMedium text-[14px] text-ink-soft">{t("stories_from_start")}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
