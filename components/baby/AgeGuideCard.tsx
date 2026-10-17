import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Milk, Moon, Sparkles, Syringe, type LucideIcon } from "lucide-react-native";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones, type ThemedTone } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { ageStage, fullMonths, isOverdue, nextVaccine } from "@/lib/baby/ageGuide";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { VaccineEntry } from "@/lib/state/babyTypes";

function Item({ icon: Glyph, tone, title, body, href, last }: {
  icon: LucideIcon;
  tone: ThemedTone;
  title: string;
  body: string;
  href: Href;
  last: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push(href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      className={`flex-row py-3 ${last ? "" : "border-b border-cream-line"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ backgroundColor: tone.tintBg }} className="mr-3 h-9 w-9 items-center justify-center rounded-xl">
        <Glyph size={18} color={tone.tint} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-[13px]" style={{ color: tone.tint }}>
          {title}
        </Text>
        <Text className="mt-0.5 font-body text-[14px] leading-5 text-ink">{body}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Kreu sipas moshës: çfarë pritet në këtë fazë (zhvillimi, ushqimi, gjumi) dhe vaksina e radhës. Tekstet ndryshojnë
 * vetë kur bebi kalon në fazën tjetër; pa datë lindjeje (ose pas 5 vjetësh) karta s'shfaqet.
 */
export function AgeGuideCard({ babyDob, vaccines, now = new Date() }: { babyDob: string | null; vaccines: VaccineEntry[]; now?: Date }) {
  const { t, lang } = useTranslation();
  const tones = useTones();
  const theme = useThemeColors();
  const stage = ageStage(fullMonths(babyDob, now));
  if (!stage) return null;

  const vaccine = nextVaccine(vaccines, now);
  const k = (part: "dev" | "feed" | "sleep") => `age_${stage}_${part}` as TranslationKey;

  const items = [
    { key: "dev", icon: Sparkles, tone: tones.purple, title: t("age_guide_dev"), body: t(k("dev")), href: "/(main)/baby/moments" as Href },
    { key: "feed", icon: Milk, tone: tones.pink, title: t("age_guide_feed"), body: t(k("feed")), href: "/(main)/baby/feeding" as Href },
    { key: "sleep", icon: Moon, tone: tones.blue, title: t("age_guide_sleep"), body: t(k("sleep")), href: "/(main)/baby/sleep" as Href },
  ];
  if (vaccine) {
    const date = formatDate(vaccine.dueDate, lang);
    items.push({
      key: "vaccine",
      icon: Syringe,
      tone: isOverdue(vaccine, now) ? tones.orange : tones.green,
      title: t("age_guide_vaccine"),
      body: t(isOverdue(vaccine, now) ? "age_guide_vaccine_late" : "age_guide_vaccine_due", { name: vaccine.name, date }),
      href: "/(main)/baby/vaccinations" as Href,
    });
  }

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface px-4 pt-4 pb-2">
      <View className="mb-1 flex-row items-baseline justify-between">
        <Text accessibilityRole="header" className="font-display text-[17px] text-ink">
          {t("age_guide_title")}
        </Text>
        <Text className="font-bodyMedium text-[12.5px]" style={{ color: theme.inkSoft }}>
          {t(`age_stage_${stage}` as TranslationKey)}
        </Text>
      </View>
      {items.map((it, i) => (
        <Item key={it.key} icon={it.icon} tone={it.tone} title={it.title} body={it.body} href={it.href} last={i === items.length - 1} />
      ))}
      <Text className="pb-2 font-body text-[11px] leading-4 text-ink-faint">{t("age_guide_note")}</Text>
    </View>
  );
}
