import { memo } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import { Castle, Clock, Compass, Heart, HeartHandshake, Lightbulb, Moon, PawPrint, Rainbow, type LucideIcon } from "lucide-react-native";
import { StoryCover } from "@/components/stories/StoryCover";
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

/** Rreshti i listës: ilustrimi, titulli, përshkrimi dhe koha e leximit. */
export const StoryRow = memo(function StoryRow({ story, favorite, progress, onPress }: RowProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const meta = useStoryMeta();
  return (
    <Pressable
      onPress={() => onPress(story.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${meta.minutes(story)}, ${meta.ages(story)}${progress?.finished ? `. ${t("stories_finished")}` : ""}`}
      className="mb-3 flex-row gap-3.5 rounded-xl2 border border-ink/10 bg-surface p-3"
    >
      <StoryCover story={story} style={{ width: 92, height: 92 }} radius={14} />
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

/** Karta e madhe e "Të veçuarave". */
export function FeaturedCard({ story, width, onPress }: { story: StoryMeta; width: number; onPress: (slug: string) => void }) {
  const meta = useStoryMeta();
  return (
    <Pressable
      onPress={() => onPress(story.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}. ${meta.minutes(story)}, ${meta.ages(story)}`}
      style={{ width }}
    >
      <StoryCover story={story} style={{ width, height: Math.round(width * 0.62) }} radius={20} />
      <Text className="mt-2 font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
        {story.title}
      </Text>
      <Text className="font-body text-xs text-ink-faint">
        {meta.minutes(story)} · {meta.ages(story)}
      </Text>
    </Pressable>
  );
}

/** Pllaka e vogël për "Të lexuara së fundmi" dhe "Të preferuarat". */
export function StoryTile({ story, progress, onPress, style }: { story: StoryMeta; progress: StoryProgress | null; onPress: (slug: string) => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={() => onPress(story.slug)} accessibilityRole="button" accessibilityLabel={story.title} style={[{ width: 132 }, style]}>
      <StoryCover story={story} style={{ width: 132, height: 96 }} radius={16} />
      <Text className="mt-1.5 font-bodyMedium text-[13px] leading-[17px] text-ink" numberOfLines={2}>
        {story.title}
      </Text>
      {progress && !progress.finished ? <ProgressLine progress={progress} /> : null}
    </Pressable>
  );
}
