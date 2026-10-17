import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Baby } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormField } from "@/components/baby/FormField";
import { pregnancyProgress } from "@/lib/age/engine";
import { loadPregnancyWeek, type PregnancyWeek } from "@/lib/parent/pregnancy";
import { formatDobInput, parseDobInput } from "@/lib/babyProfile";
import { saveBabyProfileRemote } from "@/lib/babySync";
import { resolveChildren } from "@/lib/children/resolve";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";

/**
 * Kreu gjatë shtatzënisë: java dhe ditët deri në lindje, përmbajtja e javës kur ekziston (`pregnancy_weeks`, e shkruan
 * Meti; pa të karta mbetet e qetë), dhe "Bebi lindi": me datëlindjen fëmija kalon vetë te foshnja (infant).
 */
export function PregnancyHome({ dueDate, babyName }: { dueDate: string | null; babyName: string | null }) {
  const { t, lang } = useTranslation();
  const tones = useTones();
  const { updateProfile } = useAppState();
  const progress = pregnancyProgress(dueDate);
  const [content, setContent] = useState<PregnancyWeek | null>(null);
  const [born, setBorn] = useState(false);
  const [name, setName] = useState(babyName ?? "");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const week = progress?.week ?? null;

  useEffect(() => {
    let alive = true;
    if (week != null) void loadPregnancyWeek(week, lang).then((c) => alive && setContent(c));
    return () => {
      alive = false;
    };
  }, [week, lang]);

  async function saveBirth() {
    const birthDate = parseDobInput(dob);
    if (!birthDate) {
      setError(t("children_err_date"));
      return;
    }
    setBusy(true);
    setError(null);
    const [y, m, d] = birthDate.split("-").map(Number);
    const babyNameNext = name.trim() || babyName || null;
    // Profili në telefon menjëherë (kreu kalon te foshnja); serveri pas (pa rrjet: në pritje, dërgohet më vonë).
    updateProfile({ babyName: babyNameNext, babyDob: new Date(y, m - 1, d).toISOString() });
    await saveBabyProfileRemote(babyNameNext, birthDate);
    await resolveChildren({ force: true }).catch(() => {});
    haptics.success();
    setBusy(false);
    setBorn(false);
  }

  if (!progress) return null;
  const pct = Math.min(1, progress.week / 40);

  return (
    <View>
      <View style={[shadows.soft, { backgroundColor: tones.pink.tintBg }]} className="mt-5 rounded-xl3 p-4">
        <Text className="font-bodySemibold text-[13px]" style={{ color: tones.pink.tint }}>
          {t("preg_week", { n: progress.week })}
        </Text>
        <Text className="mt-1 font-display text-[22px]" style={{ color: tones.ink }}>
          {progress.daysLeft > 0 ? t("preg_days_left", { n: progress.daysLeft }) : t("preg_due_now")}
        </Text>
        <View className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tones.pink.chip }}>
          <View style={{ width: `${pct * 100}%`, backgroundColor: tones.pink.tint }} className="h-2 rounded-full" />
        </View>
        {content ? (
          <View className="mt-4">
            <Text className="font-bodySemibold text-[15px]" style={{ color: tones.ink }}>
              {content.title}
            </Text>
            <Text className="mt-1 font-body text-[14px] leading-5" style={{ color: tones.inkSoft }}>
              {content.body}
            </Text>
            {content.ideas.map((idea) => (
              <Text key={idea} className="mt-1 font-body text-[13.5px] leading-5" style={{ color: tones.ink }}>
                {`• ${idea}`}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          haptics.tap();
          setBorn(true);
        }}
        accessibilityRole="button"
        style={shadows.soft}
        className="mt-4 flex-row items-center rounded-2xl bg-surface p-4"
      >
        <View style={{ backgroundColor: tones.blue.tintBg }} className="mr-3 h-10 w-10 items-center justify-center rounded-xl">
          <Baby size={20} color={tones.blue.tint} strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <Text className="font-bodySemibold text-[15px] text-ink">{t("preg_born_title")}</Text>
          <Text className="mt-0.5 font-body text-[12.5px] text-ink-soft">{t("preg_born_hint")}</Text>
        </View>
      </Pressable>

      <BottomSheet visible={born} onClose={() => setBorn(false)}>
        <View className="gap-4 pb-2">
          <Text accessibilityRole="header" className="font-display text-xl text-ink">
            {t("preg_born_title")}
          </Text>
          <FormField label={t("children_name_label")} placeholder={t("children_name_ph")} value={name} onChangeText={setName} autoCapitalize="words" />
          <FormField
            label={t("children_dob_label")}
            placeholder={t("children_dob_ph")}
            value={dob}
            onChangeText={(v) => setDob(formatDobInput(v))}
            keyboardType="number-pad"
            maxLength={10}
          />
          {error ? (
            <Text accessibilityRole="alert" className="font-body text-[13px] text-orange">
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={saveBirth}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            className="items-center rounded-2xl bg-olive py-3.5"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            <Text className="font-bodySemibold text-[15px] text-on-accent">{t("preg_born_save")}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}
