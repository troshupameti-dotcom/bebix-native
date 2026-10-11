import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import {
  NOTIFICATION_CATALOG, NOTIFICATION_GROUPS, REMINDER_GAP_MAX, REMINDER_GAP_MIN, isNotificationEnabled,
  type NotificationEntry, type NotificationKey,
} from "@/lib/notifications/catalog";
import { trackNotificationPrefs } from "@/lib/analytics/babyEvents";

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Kujtesat e boshllëqeve që prindi i rregullon vetë (orët). */
type GapKind = "feeding" | "diaper";
const GAP_KIND: Partial<Record<NotificationKey, GapKind>> = { baby_feeding: "feeding", baby_diaper: "diaper" };

function Row({
  entry, enabled, disabled, onToggle, gapHours, onGapChange, t,
}: {
  entry: NotificationEntry;
  enabled: boolean;
  disabled: boolean;
  onToggle: (key: NotificationKey, value: boolean) => void;
  /** Vetëm për ushqyerjen dhe pelenat. */
  gapHours?: number;
  onGapChange?: (hours: number) => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const theme = useThemeColors();
  const hasGap = gapHours !== undefined && onGapChange !== undefined;
  return (
    <View className="py-3 border-t border-cream-line" style={{ opacity: disabled ? 0.45 : 1 }}>
      <View className="flex-row items-center">
        <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
          <Icon name={entry.icon} size={15} color={theme.inkSoft} />
        </View>
        <View className="flex-1 mr-3">
          <Text className="font-bodyMedium text-sm text-ink">{t(entry.labelKey)}</Text>
          <Text className="font-body text-[11px] text-ink-faint leading-4 mt-0.5">
            {t(entry.hintKey, hasGap ? { n: gapHours } : undefined)}
          </Text>
        </View>
        <ThemedSwitch
          value={enabled}
          disabled={disabled}
          onValueChange={(value) => onToggle(entry.key, value)}
        />
      </View>
      {hasGap && enabled && !disabled ? (
        <View className="flex-row items-center ml-11 mt-2">
          <Text className="font-body text-[12px] text-ink-soft flex-1">{t("notif_gap_label")}</Text>
          <Pressable
            onPress={() => onGapChange(gapHours - 1)}
            disabled={gapHours <= REMINDER_GAP_MIN}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t(entry.labelKey)} -1`}
            className="w-7 h-7 rounded-full bg-cream-soft items-center justify-center"
            style={{ opacity: gapHours <= REMINDER_GAP_MIN ? 0.4 : 1 }}
          >
            <Text className="font-bodyMedium text-base text-ink">–</Text>
          </Pressable>
          <Text className="font-bodySemibold text-[13px] text-ink mx-2 w-12 text-center">
            {t("notif_gap_hours", { n: gapHours })}
          </Text>
          <Pressable
            onPress={() => onGapChange(gapHours + 1)}
            disabled={gapHours >= REMINDER_GAP_MAX}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t(entry.labelKey)} +1`}
            className="w-7 h-7 rounded-full bg-cream-soft items-center justify-center"
            style={{ opacity: gapHours >= REMINDER_GAP_MAX ? 0.4 : 1 }}
          >
            <Icon name="plus" size={13} color={theme.ink} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Zgjedhës orësh pa varësi të re: një hap para/prapa mjafton. */
function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  const theme = useThemeColors();
  return (
    <View className="flex-1 items-center">
      <Text className="font-body text-[11px] text-ink-faint mb-1.5">{label}</Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => onChange((value + 23) % 24)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} -1`}
          className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center"
        >
          <Text className="font-bodyMedium text-base text-ink">–</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink mx-3 w-14 text-center">{hourLabel(value)}</Text>
        <Pressable
          onPress={() => onChange((value + 1) % 24)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label} +1`}
          className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center"
        >
          <Icon name="plus" size={14} color={theme.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { state, setNotificationPref: savePref, setQuietHours, setReminderGap } = useAppState();
  // Ruaj, dhe analitikës i shkon vetëm sa lloje janë fikur (jo cilat).
  const setNotificationPref = (key: NotificationKey, value: boolean) => {
    savePref(key, value);
    trackNotificationPrefs({ ...state.notificationPrefs, keys: { ...state.notificationPrefs.keys, [key]: value } });
  };
  const { t } = useTranslation();
  const prefs = state.notificationPrefs;

  const pushOn = isNotificationEnabled(prefs, "push");
  const quietOff = prefs.quietFrom === prefs.quietTo;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("notif_title")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        {/* Çelësi kryesor */}
        <View style={shadows.soft} className="mx-5 bg-surface rounded-xl2 p-4 mb-4">
          <View className="flex-row items-center">
            <View className="flex-1 mr-3">
              <Text className="font-bodySemibold text-sm text-ink">{t("notif_master")}</Text>
              <Text className="font-body text-[11px] text-ink-faint leading-4 mt-0.5">{t("notif_master_hint")}</Text>
            </View>
            <ThemedSwitch value={pushOn} onValueChange={(value) => setNotificationPref("push", value)} />
          </View>
        </View>

        {/* Orët e qeta */}
        <View style={[shadows.soft, { opacity: pushOn ? 1 : 0.45 }]} className="mx-5 bg-surface rounded-xl2 p-4 mb-4">
          <Text className="font-bodySemibold text-sm text-ink mb-1">{t("notif_quiet_title")}</Text>
          <Text className="font-body text-[11px] text-ink-faint leading-4 mb-4">{t("notif_quiet_hint")}</Text>

          {quietOff ? (
            <Pressable
              onPress={() => setQuietHours(22, 7)}
              className="bg-cream-soft rounded-xl2 py-2.5 items-center"
            >
              <Text className="font-bodyMedium text-sm text-ink">{t("notif_quiet_off")}</Text>
            </Pressable>
          ) : (
            <>
              <View className="flex-row">
                <HourStepper
                  label={t("notif_quiet_from")}
                  value={prefs.quietFrom}
                  onChange={(h) => setQuietHours(h, prefs.quietTo)}
                />
                <HourStepper
                  label={t("notif_quiet_to")}
                  value={prefs.quietTo}
                  onChange={(h) => setQuietHours(prefs.quietFrom, h)}
                />
              </View>
              <Pressable onPress={() => setQuietHours(0, 0)} className="items-center mt-3">
                <Text className="font-bodyMedium text-xs text-olive">{t("notif_quiet_off")}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Grupet */}
        {NOTIFICATION_GROUPS.map(({ group, titleKey }) => {
          const entries = NOTIFICATION_CATALOG.filter((e) => e.group === group);
          return (
            <View key={group} className="mb-4">
              <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{t(titleKey)}</Text>
              <View style={shadows.soft} className="mx-5 bg-surface rounded-xl2 px-4 pb-1">
                {entries.map((entry) => {
                  const gapKind = GAP_KIND[entry.key];
                  return (
                    <Row
                      key={entry.key}
                      entry={entry}
                      enabled={isNotificationEnabled(prefs, entry.key)}
                      disabled={!pushOn}
                      onToggle={setNotificationPref}
                      gapHours={gapKind ? (gapKind === "feeding" ? prefs.feedingGapH : prefs.diaperGapH) : undefined}
                      onGapChange={gapKind ? (h) => setReminderGap(gapKind, h) : undefined}
                      t={t}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        <Text className="font-body text-[11px] text-ink-faint px-6 leading-4">{t("notif_permission_note")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
