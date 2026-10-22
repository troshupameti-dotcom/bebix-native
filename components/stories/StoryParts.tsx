import { memo } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import { BookOpen, Castle, Clock, Compass, Heart, HeartHandshake, Lightbulb, Moon, PawPrint, Rainbow, type LucideIcon } from "lucide-react-native";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { ageRangeYears } from "@/lib/stories/catalog";
import type { StoryProgress } from "@/lib/stories/userData";
import type { StoryCategory, StoryMeta } from "@/lib/stories/types";
import type { TranslationKey } from "@/lib/i18n/translations";

export const CATEGORY_META: Record<StoryCategory, { label: TranslationKey; icon: LucideIcon }> = {
  sleep: { label: "stories_cat_sleep", icon: Moon },
  nature: { label: "stories_cat_nature", icon: PawPrint },
  adventure: { label: "stories_cat_adventure", icon: Compass },
  friendship: { label: "stories_cat_friendship", icon: HeartHandshake },
  emotions: { label: "stories_cat_emotions", icon: Rainbow },
  lessons: { label: "stories_cat_lessons", icon: Lightbulb },
  classic: { label: "stories_cat_classic", icon: Castle },
};

export function useStoryMeta() {
  const { t } = useTranslation();
  return {
    minutes: (s: StoryMeta) => t("stories_minutes", { n: s.readingMinutes }),
    ages: (s: StoryMeta) => t("stories_age_range", ageRangeYears(s)),
  };
}

/** Çipi i filtrave: i zgjedhuri i zi (si butonat e app-it), të tjerët me vijë. */
export function Chip({ label, icon: Glyph, selected, onPress }: { label: string; icon?: LucideIcon; selected: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      className={`flex-row items-center gap-1.5 rounded-full px-3.5 ${selected ? "bg-ink" : "border border-ink/10 bg-surface"}`}
      style={{ minHeight: 38 }}
    >
      {Glyph ? <Glyph size={15} color={selected ? c.cream : c.inkSoft} strokeWidth={2} /> : null}
      <Text className={`font-bodyMedium text-[13px] ${selected ? "text-cream" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="mb-2.5 mt-6 flex-row items-baseline justify-between">
      <Text className="font-bodySemibold text-[16px] text-ink" accessibilityRole="header">
        {title}
      </Text>
      {sub ? <Text className="font-body text-xs text-ink-faint">{sub}</Text> : null}
    </View>
  );
}

function ProgressLine({ progress }: { progress: StoryProgress }) {
  const ratio = progress.finished ? 1 : Math.min(1, (progress.page + 1) / Math.max(1, progress.pages));
  return (
    <View className="mt-2 h-1 overflow-hidden rounded-full bg-cream-soft">
      <View className="h-1 rounded-full bg-olive" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </View>
  );
}

type RowProps = { story: StoryMeta; favorite: boolean; progress: StoryProgress | null; onPress: (slug: string) => void };

/** Rreshti i listës (telefon): libri i vogël, titulli, përshkrimi dhe koha e leximit. */
export const StoryRow = memo(function StoryRow({ story, favorite, progress, onPress }: RowProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  return (
    <Pressable
      onPress={() => onPress(story.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${meta.minutes(story)}, ${meta.ages(story)}${progress?.finished ? `. ${t("stories_finished")}` : ""}`}
      className="mb-3 flex-row items-center gap-4 rounded-xl2 border border-ink/10 bg-surface py-3 pl-3.5 pr-3"
    >
      <StoryBookCover story={story} width={64} showTitle={false} />
      <View className="flex-1 justify-center">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 font-bodySemibold text-[15px] leading-5 text-ink" numberOfLines={2}>
            {story.title}
          </Text>
          {favorite ? <Heart size={15} color={c.orange} fill={c.orange} /> : null}
        </View>
        <Text className="mt-1 font-body text-[12.5px] leading-[17px] text-ink-soft" numberOfLines={2}>
          {story.summary}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Clock size={12} color={c.inkFaint} />
          <Text className="font-body text-[11.5px] text-ink-faint">
            {meta.minutes(story)} · {meta.ages(story)}
            {progress?.finished ? ` · ${t("stories_finished")}` : ""}
          </Text>
        </View>
        {progress && !progress.finished ? <ProgressLine progress={progress} /> : null}
      </View>
    </Pressable>
  );
});

/** Libri me titull në kopertinë: "Të veçuarat" dhe rrjeti i librave në ekranet e gjera. */
export const BookCard = memo(function BookCard({
  story,
  width,
  titleFont,
  favorite,
  progress,
  onPress,
}: {
  story: StoryMeta;
  width: number;
  titleFont?: string;
  favorite?: boolean;
  progress?: StoryProgress | null;
  onPress: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  return (
    <Pressable
      onPress={() => onPress(story.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${meta.minutes(story)}, ${meta.ages(story)}${progress?.finished ? `. ${t("stories_finished")}` : ""}`}
      style={{ width }}
    >
      <StoryBookCover story={story} width={width} titleFont={titleFont} />
      <View className="mt-2.5 flex-row items-center gap-1.5">
        <Text className="flex-1 font-body text-xs text-ink-faint" numberOfLines={1}>
          {meta.minutes(story)} · {meta.ages(story)}
          {progress?.finished ? ` · ${t("stories_finished")}` : ""}
        </Text>
        {favorite ? <Heart size={13} color={c.orange} fill={c.orange} /> : null}
      </View>
      {progress && !progress.finished ? <ProgressLine progress={progress} /> : null}
    </Pressable>
  );
});

/** Libri i vogël për "Të lexuara së fundmi" dhe "Të preferuarat", me sa është lexuar. */
export function StoryTile({ story, progress, onPress, style }: { story: StoryMeta; progress: StoryProgress | null; onPress: (slug: string) => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={() => onPress(story.slug)} accessibilityRole="button" accessibilityLabel={story.title} style={[{ width: 96 }, style]}>
      <StoryBookCover story={story} width={96} showTitle={false} />
      <Text className="mt-2 font-bodyMedium text-[12.5px] leading-4 text-ink" numberOfLines={2}>
        {story.title}
      </Text>
      {progress && !progress.finished ? <ProgressLine progress={progress} /> : null}
    </Pressable>
  );
}

/** "Përrallë për sonte" në krye të bibliotekës: libri, përshkrimi dhe "Lexo tani" (ose "Vazhdo leximin"). */
export function HeroCard({
  story,
  wide,
  fonts,
  progress,
  onOpen,
  onRead,
}: {
  story: StoryMeta;
  wide: boolean;
  fonts: { title: string; italic: string };
  progress: StoryProgress | null;
  onOpen: (slug: string) => void;
  onRead: (slug: string, from: number) => void;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  const resume = progress && !progress.finished && progress.page > 0 ? progress.page : 0;
  return (
    <View className="mt-2 flex-row items-center gap-4 rounded-xl3 bg-cream-soft" style={{ padding: wide ? 24 : 16 }}>
      <Pressable onPress={() => onOpen(story.slug)} accessibilityRole="button" accessibilityLabel={story.title}>
        <StoryBookCover story={story} width={wide ? 150 : 108} showTitle={wide} titleFont={fonts.title} />
      </Pressable>
      <View className="flex-1">
        <Text className="font-bodyMedium text-[12px] uppercase tracking-wider text-ink-soft">{t("stories_tonight")}</Text>
        <Text style={{ fontFamily: fonts.title, fontSize: wide ? 26 : 20, lineHeight: wide ? 32 : 25, color: c.ink, marginTop: 4 }} numberOfLines={2}>
          {story.title}
        </Text>
        <Text style={{ fontFamily: fonts.italic, fontSize: wide ? 15.5 : 13.5, lineHeight: wide ? 23 : 19, color: c.inkSoft, marginTop: 4 }} numberOfLines={wide ? 3 : 2}>
          {story.summary}
        </Text>
        <Text className="mt-1.5 font-body text-[11.5px] text-ink-faint">
          {meta.minutes(story)} · {meta.ages(story)}
        </Text>
        <Pressable
          onPress={() => onRead(story.slug, resume)}
          accessibilityRole="button"
          className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-ink px-4"
          style={{ minHeight: 40 }}
        >
          <BookOpen size={15} color={c.cream} />
          <Text className="font-bodySemibold text-[13.5px] text-cream">{resume ? t("stories_continue") : t("stories_read_now")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
