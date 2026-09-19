import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  fetchMedicationSchedules, createMedicationSchedule, stopMedicationSchedule, markDoseGiven,
  type MedicationSchedule,
} from "@/lib/baby/medicationSchedules";

const INTERVALS = [4, 6, 8, 12, 24];
const DAY_OPTIONS = [3, 5, 7, 10];

type Translate = (key: any, params?: Record<string, string | number>) => string;

function nextDose(schedule: MedicationSchedule, t: Translate): string {
  const base = schedule.lastSentAt ? new Date(schedule.lastSentAt) : new Date(schedule.startAt);
  const next = new Date(base.getTime() + (schedule.lastSentAt ? schedule.intervalHours * 3600000 : 0));
  const diffMin = Math.round((next.getTime() - Date.now()) / 60000);

  if (diffMin <= 0) return t("med_now");
  if (diffMin < 60) return t("med_in_min", { n: diffMin });
  return t("med_in_hours", { n: Math.round(diffMin / 60) });
}

/**
 * Kujtesat e ilaçeve.
 *
 * Nuk mban dozat e dhëna — ato shënohen si regjistrime mjekësore. Kjo mban
 * vetëm orarin: sa orë, deri kur. Dërgimin e bën serveri, që kujtesa të
 * vijë edhe kur app-i është i mbyllur.
 */
export function MedicationReminders() {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [intervalHours, setIntervalHours] = useState(8);
  const [days, setDays] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSchedules(await fetchMedicationSchedules());
    } catch {
      // Pa lidhje: seksioni rri bosh, pjesa tjetër e ekranit punon.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSave() {
    if (!name.trim()) {
      setError(t("med_need_name"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createMedicationSchedule({ name, dose, intervalHours, days });
      haptics.tap();
      setName("");
      setDose("");
      setAdding(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("med_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  function confirmStop(schedule: MedicationSchedule) {
    Alert.alert(t("med_stop_q"), t("med_stop_body", { name: schedule.name }), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("med_stop"),
        style: "destructive",
        onPress: async () => {
          await stopMedicationSchedule(schedule.id);
          await load();
        },
      },
    ]);
  }

  const active = schedules.filter((s) => s.active);

  return (
    <View className="px-5 mt-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-bodySemibold text-base text-ink">{t("med_title")}</Text>
        {!adding && (
          <Pressable onPress={() => setAdding(true)} hitSlop={8} accessibilityRole="button">
            <Text className="font-bodyMedium text-xs text-olive">{t("med_add")}</Text>
          </Pressable>
        )}
      </View>

      {adding && (
        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3">
          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("med_name")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("med_ph_name")}
            placeholderClassName="text-ink-faint"
            maxLength={80}
            className="bg-cream-soft rounded-xl2 px-3 py-2.5 font-body text-sm text-ink mb-3"
          />

          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("med_dose")}</Text>
          <TextInput
            value={dose}
            onChangeText={setDose}
            placeholder={t("med_ph_dose")}
            placeholderClassName="text-ink-faint"
            maxLength={60}
            className="bg-cream-soft rounded-xl2 px-3 py-2.5 font-body text-sm text-ink mb-3"
          />

          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("med_every")}</Text>
          <View className="flex-row mb-3">
            {INTERVALS.map((h) => (
              <Pressable
                key={h}
                onPress={() => setIntervalHours(h)}
                accessibilityRole="button"
                accessibilityState={{ selected: intervalHours === h }}
                className={`px-3.5 py-2 rounded-full mr-2 ${intervalHours === h ? "bg-ink" : "bg-cream-soft"}`}
              >
                <Text className={`font-bodyMedium text-xs ${intervalHours === h ? "text-on-accent" : "text-ink-soft"}`}>
                  {h}h
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("med_days")}</Text>
          <View className="flex-row mb-3">
            {DAY_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: days === d }}
                className={`px-3.5 py-2 rounded-full mr-2 ${days === d ? "bg-ink" : "bg-cream-soft"}`}
              >
                <Text className={`font-bodyMedium text-xs ${days === d ? "text-on-accent" : "text-ink-soft"}`}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>

          {error && <Text className="font-body text-xs text-orange mb-2">{error}</Text>}

          <View className="flex-row">
            <Pressable
              onPress={() => { setAdding(false); setError(null); }}
              className="flex-1 bg-cream-soft rounded-xl2 py-3 items-center mr-2"
            >
              <Text className="font-bodyMedium text-sm text-ink">{t("cancel_action")}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-olive rounded-xl2 py-3 items-center"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text className="font-bodySemibold text-sm text-on-accent">{t("save_action")}</Text>
              )}
            </Pressable>
          </View>

          <Text className="font-body text-[11px] text-ink-faint leading-4 mt-3">
            {t("med_first_note", { n: intervalHours })}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator className="text-olive" />
      ) : active.length === 0 ? (
        !adding && (
          <Text className="font-body text-xs text-ink-soft leading-5">
            {t("med_empty")}
          </Text>
        )
      ) : (
        active.map((schedule) => (
          <View key={schedule.id} style={shadows.soft} className="bg-surface rounded-xl2 p-3.5 mb-2 flex-row items-center">
            <View className="w-9 h-9 rounded-full bg-olive-bg items-center justify-center mr-3">
              <Icon name="pill" size={16} color="#6E7452" />
            </View>
            <View className="flex-1">
              <Text className="font-bodyMedium text-sm text-ink">
                {schedule.name}{schedule.dose ? ` · ${schedule.dose}` : ""}
              </Text>
              <Text className="font-body text-[11px] text-ink-faint mt-0.5">
                {t("med_every_hours", { n: schedule.intervalHours })} · {t("med_next", { when: nextDose(schedule, t) })}
              </Text>
            </View>
            <View className="items-end">
              <Pressable
                onPress={async () => { haptics.tap(); await markDoseGiven(schedule.id); await load(); }}
                accessibilityRole="button"
                className="bg-olive rounded-full px-3 py-1.5 mb-1.5"
              >
                <Text className="font-bodyMedium text-[11px] text-on-accent">{t("med_given")}</Text>
              </Pressable>
              <Pressable onPress={() => confirmStop(schedule)} hitSlop={8} accessibilityRole="button">
                <Text className="font-bodyMedium text-[11px] text-ink-faint">{t("med_stop")}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
