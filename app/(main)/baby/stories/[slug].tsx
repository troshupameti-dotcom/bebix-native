import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, Clock, Heart, RotateCcw } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { CATEGORY_META, useStoryMeta } from "@/components/stories/StoryParts";
import { useBookFonts } from "@/components/stories/book/theme";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { loadStory } from "@/lib/stories/api";
import { toggleFavorite, useStoryUserData } from "@/lib/stories/userData";
import type { Story } from "@/lib/stories/types";

type State = { kind: "loading" } | { kind: "ready"; story: Story } | { kind: "missing" } | { kind: "error" };

/** Ekranet e gjera (tablet, telefon i palosshëm, web): kopertina në të majtë, të dhënat në të djathtë. */
const WIDE = 720;

/** Faqja e një përralle: kopertina si libër, koha e leximit, mosha, kategoritë, përshkrimi, dhe "Lexo" / "Vazhdo". */
export default function StoryDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  const fonts = useBookFonts();
  const user = useStoryUserData();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const wide = width >= WIDE;

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
  const paragraphs = story?.paragraphs.length ?? 0;
  const resumeFrom = progress && !progress.finished && progress.page > 0 && progress.page < paragraphs ? progress.page : 0;
  const percent = resumeFrom ? Math.max(1, Math.round((resumeFrom / paragraphs) * 100)) : 0;
  const favorite = story ? user.isFavorite(story.slug) : false;

  const read = (from: number) => {
    if (!story) return;
    haptics.tap();
    router.push({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: story.slug, from: String(from) } });
  };

  const actions = story ? (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => read(resumeFrom)} accessibilityRole="button" className="flex-row items-center justify-center gap-2 rounded-full bg-ink" style={{ minHeight: 52 }}>
        <BookOpen size={18} color={c.cream} />
        <Text className="font-bodySemibold text-[15.5px] text-cream">
          {resumeFrom > 0 ? t("stories_continue") : progress?.finished ? t("stories_read_again") : t("stories_read")}
        </Text>
      </Pressable>
      {resumeFrom > 0 ? (
        <Pressable onPress={() => read(0)} accessibilityRole="button" className="flex-row items-center justify-center gap-2" style={{ minHeight: 44 }}>
          <RotateCcw size={15} color={c.inkSoft} />
          <Text className="font-bodyMedium text-[14px] text-ink-soft">{t("stories_from_start")}</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom", "left", "right"]}>
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
      ) : !story ? (
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
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, alignItems: "center" }}>
            <View style={{ width: "100%", maxWidth: 980, flexDirection: wide ? "row" : "column", gap: wide ? 36 : 0, alignItems: wide ? "flex-start" : "stretch" }}>
              <View className="items-center rounded-xl3 bg-cream-soft" style={{ paddingVertical: wide ? 40 : 28, width: wide ? 340 : "100%" }}>
                <StoryBookCover
                  story={story}
                  width={wide ? 230 : Math.min(210, Math.round(width * 0.5))}
                  titleFont={fonts.title}
                  captionFont={fonts.italic}
                  caption={t("stories_book_by")}
                />
              </View>
              <View style={{ flex: wide ? 1 : undefined, paddingTop: wide ? 8 : 0 }}>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.title, fontSize: wide ? 34 : 28, lineHeight: wide ? 42 : 35, color: c.ink, marginTop: wide ? 0 : 22 }}>
                  {story.title}
                </Text>
                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={14} color={c.inkSoft} />
                    <Text className="font-body text-[13px] text-ink-soft">{t("stories_reading_time", { n: story.readingMinutes })}</Text>
                  </View>
                  <Text className="font-body text-[13px] text-ink-soft">{meta.ages(story)}</Text>
                  {progress?.finished ? <Text className="font-bodyMedium text-[13px] text-olive">{t("stories_finished")}</Text> : null}
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
                <Text style={{ fontFamily: fonts.italic, fontSize: 17, lineHeight: 27, color: c.ink, marginTop: 16 }}>{story.summary}</Text>
                {resumeFrom > 0 ? (
                  <View className="mt-5">
                    <View className="h-1 overflow-hidden rounded-full bg-cream-soft">
                      <View className="h-1 rounded-full bg-olive" style={{ width: `${percent}%` }} />
                    </View>
                    <Text className="mt-1.5 font-body text-xs text-ink-faint">{t("stories_progress_pct", { n: percent })}</Text>
                  </View>
                ) : null}
                {wide ? <View style={{ marginTop: 24, maxWidth: 380 }}>{actions}</View> : null}
              </View>
            </View>
          </ScrollView>
          {wide ? null : <View className="border-t border-ink/10 px-5 pb-2 pt-3">{actions}</View>}
        </>
      )}
    </SafeAreaView>
  );
}
