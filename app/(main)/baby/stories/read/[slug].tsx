import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Heart } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { StoryCover } from "@/components/stories/StoryCover";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { cachedIndex, loadStory } from "@/lib/stories/api";
import { fitsBand, bandForMonths } from "@/lib/stories/catalog";
import { saveProgress, toggleFavorite, useStoryUserData } from "@/lib/stories/userData";
import { useActiveChild } from "@/lib/age/useActiveChild";
import type { Story, StoryMeta } from "@/lib/stories/types";

/** Madhësitë e tekstit (pikë); prindi i ndërron me A− / A+ dhe zgjedhja ruhet në telefon. */
const TEXT_SIZES = [17, 19, 22, 25, 29] as const;
const DEFAULT_SIZE = 2;
const SIZE_KEY = "bebix_story_text_size_v1";

type State = { kind: "loading" } | { kind: "ready"; story: Story } | { kind: "missing" } | { kind: "error" };

/** Përralla tjetër: e radhës në bibliotekë që i përshtatet moshës, pa e përsëritur këtë. */
function nextStory(current: string, months: number | null): StoryMeta | null {
  const list = cachedIndex().stories;
  const band = bandForMonths(months);
  const pool = band ? list.filter((s) => fitsBand(s, band)) : list;
  const from = pool.length > 1 ? pool : list;
  if (from.length < 2) return null;
  const i = from.findIndex((s) => s.slug === current);
  return from[(i + 1) % from.length] ?? null;
}

export default function StoryReader() {
  const params = useLocalSearchParams<{ slug: string; page?: string }>();
  const slug = String(params.slug ?? "");
  const { t } = useTranslation();
  const c = useThemeColors();
  const { months } = useActiveChild();
  const user = useStoryUserData();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [page, setPage] = useState(0);
  const [ended, setEnded] = useState(false);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(SIZE_KEY)
      .then((v) => {
        const n = v == null ? NaN : Number(v);
        if (Number.isInteger(n) && n >= 0 && n < TEXT_SIZES.length) setSize(n);
      })
      .catch(() => {});
  }, []);

  const [attempt, setAttempt] = useState(0);
  // Faqja e nisjes lexohet vetëm kur hapet përralla, jo kur prindi lëviz nëpër faqe.
  const startPage = useRef(Number(params.page ?? 0));

  useEffect(() => {
    let alive = true;
    (slug ? loadStory(slug) : Promise.resolve(null)).then(
      (story) => {
        if (!alive) return;
        if (!story) return setState({ kind: "missing" });
        const start = startPage.current;
        setPage(Number.isInteger(start) && start >= 0 && start < story.paragraphs.length ? start : 0);
        setState({ kind: "ready", story });
      },
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
  const pages = story?.paragraphs.length ?? 0;

  // Ruhet ku mbeti prindi; faqja e fundit e shënon përrallën të lexuar.
  useEffect(() => {
    if (story && user.ready) saveProgress(story.slug, page, pages, user.userId);
  }, [story, page, pages, user.ready, user.userId]);

  const changeSize = (delta: number) => {
    const next = Math.min(TEXT_SIZES.length - 1, Math.max(0, size + delta));
    if (next === size) return;
    haptics.tap();
    setSize(next);
    void AsyncStorage.setItem(SIZE_KEY, String(next)).catch(() => {});
  };

  const go = (to: number) => {
    haptics.tap();
    if (to >= pages) {
      setEnded(true);
      return;
    }
    setEnded(false);
    setPage(Math.max(0, to));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const favorite = story ? user.isFavorite(story.slug) : false;
  const next = story && ended ? nextStory(story.slug, months) : null;
  const fontSize = TEXT_SIZES[size];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <BackButton variant="close" fallback={slug ? (`/(main)/baby/stories/${slug}` as const) : "/(main)/baby/stories"} />
        <Text className="flex-1 font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
          {story?.title ?? ""}
        </Text>
        {story ? (
          <>
            <Pressable
              onPress={() => changeSize(-1)}
              disabled={size === 0}
              accessibilityRole="button"
              accessibilityLabel={t("stories_text_smaller")}
              accessibilityState={{ disabled: size === 0 }}
              className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-surface"
              style={{ opacity: size === 0 ? 0.4 : 1 }}
            >
              <AArrowDown size={19} color={c.ink} />
            </Pressable>
            <Pressable
              onPress={() => changeSize(1)}
              disabled={size === TEXT_SIZES.length - 1}
              accessibilityRole="button"
              accessibilityLabel={t("stories_text_bigger")}
              accessibilityState={{ disabled: size === TEXT_SIZES.length - 1 }}
              className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-surface"
              style={{ opacity: size === TEXT_SIZES.length - 1 ? 0.4 : 1 }}
            >
              <AArrowUp size={19} color={c.ink} />
            </Pressable>
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
              <Heart size={18} color={favorite ? c.orange : c.inkSoft} fill={favorite ? c.orange : "transparent"} />
            </Pressable>
          </>
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
      ) : ended ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 12 }}>
          <StoryCover story={story} style={{ width: "100%", aspectRatio: 16 / 10 }} radius={24} />
          <Text className="mt-6 text-center font-display text-[28px] text-ink" accessibilityRole="header">
            {t("stories_the_end")}
          </Text>
          <Text className="mt-2 text-center font-body text-[15px] leading-6 text-ink-soft">{t("stories_end_body")}</Text>
          <View className="mt-6 gap-2.5">
            {next ? (
              <Pressable
                onPress={() => router.replace({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: next.slug, page: "0" } })}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-surface p-3"
              >
                <StoryCover story={next} style={{ width: 64, height: 52 }} radius={12} />
                <View className="flex-1">
                  <Text className="font-body text-xs text-ink-faint">{t("stories_next_story")}</Text>
                  <Text className="font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
                    {next.title}
                  </Text>
                </View>
                <ChevronRight size={18} color={c.inkSoft} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => go(0)} accessibilityRole="button" className="items-center justify-center rounded-full bg-ink" style={{ minHeight: 48 }}>
              <Text className="font-bodySemibold text-[15px] text-cream">{t("stories_read_again")}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/(main)/baby/stories")}
              accessibilityRole="button"
              className="items-center justify-center rounded-full border border-ink/15"
              style={{ minHeight: 48 }}
            >
              <Text className="font-bodyMedium text-[15px] text-ink">{t("stories_back_to_library")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <>
          <View className="px-5">
            <View className="h-1 overflow-hidden rounded-full bg-cream-soft">
              <View className="h-1 rounded-full bg-olive" style={{ width: `${Math.round(((page + 1) / pages) * 100)}%` }} />
            </View>
            <Text className="mt-1.5 font-body text-xs text-ink-faint" accessibilityLiveRegion="polite">
              {t("stories_page_of", { n: page + 1, total: pages })}
            </Text>
          </View>
          <ScrollView ref={scroll} className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
            {page === 0 ? (
              <>
                <StoryCover story={story} style={{ width: "100%", aspectRatio: 16 / 10 }} radius={24} />
                <Text className="mb-4 mt-5 font-display text-[24px] leading-8 text-ink" accessibilityRole="header">
                  {story.title}
                </Text>
              </>
            ) : null}
            <Text className="font-body text-ink" style={{ fontSize, lineHeight: Math.round(fontSize * 1.55) }}>
              {story.paragraphs[page]}
            </Text>
          </ScrollView>
          <View className="flex-row items-center gap-3 border-t border-ink/10 px-5 pb-2 pt-3">
            <Pressable
              onPress={() => go(page - 1)}
              disabled={page === 0}
              accessibilityRole="button"
              accessibilityLabel={t("stories_prev")}
              accessibilityState={{ disabled: page === 0 }}
              className="h-12 w-12 items-center justify-center rounded-full border border-ink/15"
              style={{ opacity: page === 0 ? 0.35 : 1 }}
            >
              <ChevronLeft size={22} color={c.ink} />
            </Pressable>
            <Pressable
              onPress={() => go(page + 1)}
              accessibilityRole="button"
              accessibilityLabel={page === pages - 1 ? t("stories_finish") : t("stories_next")}
              className="h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-ink"
            >
              <Text className="font-bodySemibold text-[15px] text-cream">{page === pages - 1 ? t("stories_finish") : t("stories_next")}</Text>
              {page === pages - 1 ? null : <ChevronRight size={18} color={c.cream} />}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
