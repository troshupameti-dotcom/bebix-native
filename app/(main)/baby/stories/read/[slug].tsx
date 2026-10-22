import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, AccessibilityInfo, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ChevronLeft, ChevronRight, Heart, Minus, Plus, Type, X } from "lucide-react-native";
import { Book, type BookHandle } from "@/components/stories/book/Book";
import { BlankPage, CoverPage, EndPage, MeasureLines, TextPage } from "@/components/stories/book/Pages";
import {
  BASE_SIZES,
  DEFAULT_SIZE,
  anchorOfPosition,
  bookMetrics,
  buildBook,
  linesToSlices,
  packPages,
  paragraphPages,
  positionCount,
  positionOfAnchor,
  visiblePageNumbers,
  type Anchor,
  type BookMode,
} from "@/components/stories/book/layout";
import { READER_THEMES, READER_THEME_ORDER, useBookFonts, type ReaderThemeName } from "@/components/stories/book/theme";
import { useStoryMeta } from "@/components/stories/StoryParts";
import { goBackOr } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { cachedIndex, loadStory } from "@/lib/stories/api";
import { fitsBand, bandForMonths } from "@/lib/stories/catalog";
import { saveProgress, toggleFavorite, useStoryUserData } from "@/lib/stories/userData";
import { useActiveChild } from "@/lib/age/useActiveChild";
import type { Story, StoryMeta } from "@/lib/stories/types";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Madhësia e tekstit dhe pamja e librit, të ruajtura në telefon. */
const SETTINGS_KEY = "bebix_story_reader_v1";
const KEEP_AWAKE_TAG = "bebix-story";
const THEME_LABEL: Record<ReaderThemeName, TranslationKey> = { paper: "stories_theme_paper", sepia: "stories_theme_sepia", night: "stories_theme_night" };

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
  const params = useLocalSearchParams<{ slug: string; from?: string }>();
  const slug = String(params.slug ?? "");
  const { t } = useTranslation();
  const app = useThemeColors();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { months } = useActiveChild();
  const user = useStoryUserData();
  const meta = useStoryMeta();
  const fonts = useBookFonts();
  const book = useRef<BookHandle>(null);

  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<{ size: number; theme: ReaderThemeName | null }>({ size: DEFAULT_SIZE, theme: null });
  const [panel, setPanel] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Hapësira e librit; derisa ta masë ekrani, vlerësohet nga dritarja.
  const [area, setArea] = useState(() => ({
    w: window.width - insets.left - insets.right,
    h: window.height - insets.top - insets.bottom - 124,
  }));
  const [anchor, setAnchor] = useState<Anchor>(() => {
    const from = Number(params.from ?? 0);
    return Number.isInteger(from) && from > 0 ? { kind: "text", paragraph: from, offset: 0 } : { kind: "cover" };
  });
  const [measured, setMeasured] = useState<{ key: string; slices: string[][] } | null>(null);
  const [fallbackKey, setFallbackKey] = useState<string | null>(null);

  const theme = READER_THEMES[settings.theme ?? (app.isDark ? "night" : "paper")];
  const metrics = bookMetrics(area.w, area.h, settings.size);

  useEffect(() => {
    let alive = true;
    (slug ? loadStory(slug) : Promise.resolve(null)).then(
      (story) => alive && setState(story ? { kind: "ready", story } : { kind: "missing" }),
      () => alive && setState({ kind: "error" })
    );
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as { size?: number; theme?: ReaderThemeName }) : null;
        if (!saved) return;
        setSettings({
          size: Number.isInteger(saved.size) && saved.size! >= 0 && saved.size! < BASE_SIZES.length ? saved.size! : DEFAULT_SIZE,
          theme: saved.theme && saved.theme in READER_THEMES ? saved.theme : null,
        });
      })
      .catch(() => {});
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    // Ekrani s'fiket ndërsa prindi lexon me zë.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
      void Promise.resolve()
        .then(() => deactivateKeepAwake(KEEP_AWAKE_TAG))
        .catch(() => {});
    };
  }, []);

  const story = state.kind === "ready" ? state.story : null;
  const paragraphs = story?.paragraphs;

  // Ndarja në faqe: sipas rreshtave të matur; pa matje (web, ose kur matja s'vjen), një paragraf në faqe.
  const measureKey = `${slug}|${fonts.body}|${metrics.fontSize}|${metrics.innerW}`;
  const exact = measured?.key === measureKey ? measured : null;
  const fallback = !exact && (fallbackKey === measureKey || Platform.OS === "web");
  useEffect(() => {
    if (!story || exact || Platform.OS === "web") return;
    const id = setTimeout(() => setFallbackKey(measureKey), 900);
    return () => clearTimeout(id);
  }, [story, exact, measureKey]);

  const lineHeight = metrics.lineHeight;
  const innerH = metrics.innerH;
  const paragraphGap = metrics.paragraphGap;
  const mode: BookMode = metrics.mode;
  const pages = useMemo(() => {
    if (!paragraphs) return null;
    const source = exact ?? (fallback ? null : measured);
    const textPages = source ? packPages(source.slices, { innerH, lineHeight, paragraphGap }) : fallback ? paragraphPages(paragraphs) : null;
    return textPages ? buildBook(textPages, mode) : null;
  }, [paragraphs, exact, fallback, measured, innerH, lineHeight, paragraphGap, mode]);

  const position = pages ? positionOfAnchor(pages, mode, anchor) : 0;
  const count = pages ? positionCount(pages, mode) : 1;
  const atEnd = anchor.kind === "end";

  // Vendi i leximit ruhet sipas paragrafit; "Fund" e shënon përrallën të lexuar.
  useEffect(() => {
    if (!story || !user.ready) return;
    const n = story.paragraphs.length;
    if (anchor.kind === "end") saveProgress(story.slug, n - 1, n, user.userId, true);
    else saveProgress(story.slug, anchor.kind === "text" ? Math.min(anchor.paragraph, n - 1) : 0, n, user.userId);
  }, [story, anchor, user.ready, user.userId]);

  const onTurn = useCallback(
    (dir: 1 | -1) => {
      if (!pages) return;
      haptics.tap();
      setAnchor((prev) => {
        const next = Math.min(positionCount(pages, mode) - 1, Math.max(0, positionOfAnchor(pages, mode, prev) + dir));
        return anchorOfPosition(pages, mode, next);
      });
    },
    [pages, mode]
  );

  const updateSettings = (next: { size?: number; theme?: ReaderThemeName }) => {
    haptics.tap();
    const merged = { size: next.size ?? settings.size, theme: next.theme ?? settings.theme };
    setSettings(merged);
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)).catch(() => {});
  };

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  const next = story && atEnd ? nextStory(story.slug, months) : null;
  const favorite = story ? user.isFavorite(story.slug) : false;
  const numbers = pages ? visiblePageNumbers(pages, mode, position) : [1];
  const pageLabel =
    numbers.length > 1 && numbers[1] !== numbers[0]
      ? t("stories_pages_of", { a: numbers[0], b: numbers[1], total: pages?.length ?? 1 })
      : t("stories_page_of", { n: numbers[0], total: pages?.length ?? 1 });

  const renderPage = (i: number) => {
    const p = pages?.[i];
    if (!p || !story) return null;
    if (p.kind === "cover") {
      return (
        <CoverPage
          story={story}
          metrics={metrics}
          fonts={fonts}
          theme={theme}
          byline={t("stories_book_by")}
          meta={`${t("stories_reading_time", { n: story.readingMinutes })} · ${meta.ages(story)}`}
          hint={position === 0 && count > 1 ? t("stories_swipe_hint") : undefined}
        />
      );
    }
    if (p.kind === "text") return <TextPage blocks={p.blocks} number={p.number} metrics={metrics} fonts={fonts} theme={theme} scrollable={fallback} />;
    if (p.kind === "end") {
      return (
        <EndPage
          metrics={metrics}
          fonts={fonts}
          theme={theme}
          next={next}
          labels={{ end: t("stories_the_end"), body: t("stories_end_body"), again: t("stories_read_again"), next: t("stories_next_story"), library: t("stories_back_to_library") }}
          onAgain={() => {
            haptics.tap();
            setAnchor({ kind: "cover" });
          }}
          onNext={() => next && router.replace({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: next.slug } })}
          onLibrary={() => router.replace("/(main)/baby/stories")}
        />
      );
    }
    return <BlankPage theme={theme} />;
  };

  const iconButton = { width: 44, height: 44, borderRadius: 22, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: theme.edge };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.desk }} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style={theme.statusBar} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
        <Pressable
          onPress={() => goBackOr(slug ? `/(main)/baby/stories/${slug}` : "/(main)/baby/stories")}
          accessibilityRole="button"
          accessibilityLabel={t("stories_close")}
          style={iconButton}
        >
          <X size={20} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: fonts.italic, fontSize: 15, color: theme.faint, textAlign: "center" }} numberOfLines={1}>
          {story?.title ?? ""}
        </Text>
        {story ? (
          <>
            <Pressable
              onPress={() => setPanel(!panel)}
              accessibilityRole="button"
              accessibilityLabel={t("stories_reader_settings")}
              accessibilityState={{ expanded: panel }}
              style={[iconButton, panel ? { backgroundColor: theme.edge } : null]}
            >
              <Type size={19} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.tap();
                toggleFavorite(story.slug, user.userId);
              }}
              accessibilityRole="button"
              accessibilityLabel={favorite ? t("stories_favorite_remove") : t("stories_favorite_add")}
              accessibilityState={{ selected: favorite }}
              style={iconButton}
            >
              <Heart size={18} color={favorite ? app.orange : theme.text} fill={favorite ? app.orange : "transparent"} />
            </Pressable>
          </>
        ) : null}
      </View>

      {panel ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + 60,
            right: Math.max(12, insets.right + 12),
            zIndex: 10,
            width: 280,
            maxWidth: window.width - 24,
            borderRadius: 20,
            padding: 16,
            backgroundColor: theme.page,
            borderWidth: 1,
            borderColor: theme.edge,
            gap: 14,
          }}
        >
          <Text style={{ fontFamily: fonts.title, fontSize: 15, color: theme.text }}>{t("stories_text_size")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => updateSettings({ size: Math.max(0, settings.size - 1) })}
              disabled={settings.size === 0}
              accessibilityRole="button"
              accessibilityLabel={t("stories_text_smaller")}
              accessibilityState={{ disabled: settings.size === 0 }}
              style={[iconButton, { opacity: settings.size === 0 ? 0.35 : 1 }]}
            >
              <Minus size={18} color={theme.text} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {BASE_SIZES.map((s, i) => (
                <Text key={s} style={{ fontFamily: fonts.body, fontSize: s - 2, color: i === settings.size ? theme.text : theme.edge }}>
                  A
                </Text>
              ))}
            </View>
            <Pressable
              onPress={() => updateSettings({ size: Math.min(BASE_SIZES.length - 1, settings.size + 1) })}
              disabled={settings.size === BASE_SIZES.length - 1}
              accessibilityRole="button"
              accessibilityLabel={t("stories_text_bigger")}
              accessibilityState={{ disabled: settings.size === BASE_SIZES.length - 1 }}
              style={[iconButton, { opacity: settings.size === BASE_SIZES.length - 1 ? 0.35 : 1 }]}
            >
              <Plus size={18} color={theme.text} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {READER_THEME_ORDER.map((name) => {
              const th = READER_THEMES[name];
              const selected = theme === th;
              return (
                <Pressable
                  key={name}
                  onPress={() => updateSettings({ theme: name })}
                  accessibilityRole="button"
                  accessibilityLabel={t(THEME_LABEL[name])}
                  accessibilityState={{ selected }}
                  style={{ alignItems: "center", gap: 6, minWidth: 64 }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: th.page,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected ? theme.button : th.edge,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontFamily: fonts.title, fontSize: 16, color: th.text }}>A</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.faint }}>{t(THEME_LABEL[name])}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {state.kind === "loading" || (story && !pages) ? (
          <ActivityIndicator color={theme.faint} accessibilityLabel={t("stories_loading")} />
        ) : !story || !pages ? (
          <View style={{ alignItems: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontFamily: fonts.title, fontSize: 16, color: theme.text, textAlign: "center" }}>
              {state.kind === "missing" ? t("stories_not_found") : t("stories_load_error")}
            </Text>
            <Pressable
              onPress={() => (state.kind === "missing" ? router.replace("/(main)/baby/stories") : retry())}
              accessibilityRole="button"
              style={{ marginTop: 16, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: "center", backgroundColor: theme.button }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.buttonText }}>{state.kind === "missing" ? t("stories_back_to_library") : t("stories_retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <Book
            key={mode}
            ref={book}
            mode={mode}
            pageW={metrics.pageW}
            pageH={metrics.pageH}
            position={position}
            count={count}
            theme={theme}
            reduceMotion={reduceMotion}
            edgeTaps={!atEnd}
            renderPage={renderPage}
            onTurn={onTurn}
          />
        )}
        {story && !exact && !fallback && Platform.OS !== "web" ? (
          <MeasureLines
            key={measureKey}
            paragraphs={story.paragraphs}
            metrics={metrics}
            fonts={fonts}
            theme={theme}
            onDone={(lines) => {
              const slices = lines.map((l, i) => linesToSlices(story.paragraphs[i], l));
              if (slices.every((s): s is string[] => !!s)) setMeasured({ key: measureKey, slices });
              else setFallbackKey(measureKey);
            }}
          />
        ) : null}
      </View>

      {story && pages ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable
            onPress={() => book.current?.flip(-1)}
            disabled={position === 0}
            accessibilityRole="button"
            accessibilityLabel={t("stories_prev")}
            accessibilityState={{ disabled: position === 0 }}
            style={[iconButton, { opacity: position === 0 ? 0.3 : 1 }]}
          >
            <ChevronLeft size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ alignSelf: "stretch", height: 3, borderRadius: 2, backgroundColor: theme.edge, overflow: "hidden" }}>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: theme.faint, width: `${Math.round(((position + 1) / count) * 100)}%` }} />
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.faint }} accessibilityLiveRegion="polite">
              {pageLabel}
            </Text>
          </View>
          <Pressable
            onPress={() => book.current?.flip(1)}
            disabled={position >= count - 1}
            accessibilityRole="button"
            accessibilityLabel={t("stories_next")}
            accessibilityState={{ disabled: position >= count - 1 }}
            style={[iconButton, { opacity: position >= count - 1 ? 0.3 : 1 }]}
          >
            <ChevronRight size={22} color={theme.text} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
