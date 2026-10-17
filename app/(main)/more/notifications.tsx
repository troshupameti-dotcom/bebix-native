import type { ReactNode } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell, Cake, CalendarDays, Droplets, Heart, MessageCircle, Milk, Minus, Moon, MoonStar, Package, Pill, Plus, Reply, Ruler,
  Send, Sparkles, Star, Stethoscope, Syringe, Tag, Users, type LucideIcon,
} from "lucide-react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { IconTile, TILE_COLORS as C } from "@/components/settings/IconTile";
import { haptics } from "@/lib/haptics";
import {
  NOTIFICATION_CATALOG, NOTIFICATION_GROUPS, REMINDER_GAP_MAX, REMINDER_GAP_MIN, isNotificationEnabled,
  type NotificationEntry, type NotificationKey,
} from "@/lib/notifications/catalog";
import { trackNotificationPrefs } from "@/lib/analytics/babyEvents";

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Ikona (Lucide) dhe ngjyra e pllakës për çdo njoftim, si te Cilësimet e iPhone-it. */
const TILE: Record<NotificationEntry["key"], { icon: LucideIcon; color: string }> = {
  baby_feeding: { icon: Milk, color: C.pink },
  baby_sleep: { icon: Moon, color: C.indigo },
  baby_diaper: { icon: Droplets, color: C.teal },
  baby_medicine: { icon: Pill, color: C.red },
  baby_vaccine: { icon: Syringe, color: C.green },
  baby_growth: { icon: Ruler, color: C.orange },
  baby_milestone: { icon: Sparkles, color: C.purple },
  baby_birthday: { icon: Cake, color: C.pink },
  baby_weekly: { icon: CalendarDays, color: C.blue },
  baby_team: { icon: Heart, color: C.red },
  baby_shift: { icon: MoonStar, color: C.indigo },
  shop_order: { icon: Package, color: C.orange },
  shop_review_request: { icon: Star, color: C.orange },
  shop_offers: { icon: Tag, color: C.red },
  community_comment: { icon: MessageCircle, color: C.blue },
  community_reply: { icon: Reply, color: C.teal },
  community_like: { icon: Heart, color: C.pink },
  community_expert_post: { icon: Stethoscope, color: C.green },
  community_message: { icon: Send, color: C.blue },
  community_group_post: { icon: Users, color: C.purple },
};

/** Kujtesat e boshllëqeve që prindi i rregullon vetë (orët). */
type GapKind = "feeding" | "diaper";
const GAP_KIND: Partial<Record<NotificationKey, GapKind>> = { baby_feeding: "feeding", baby_diaper: "diaper" };

/** Kartela e grupuar (si te iPhone): titull i vogël sipër, rreshtat brenda, shënim poshtë. */
function Group({ title, footer, dim, children }: { title?: string; footer?: string; dim?: boolean; children: ReactNode }) {
  return (
    <View className="mb-6" style={{ opacity: dim ? 0.45 : 1 }}>
      {title ? (
        <Text accessibilityRole="header" className="mb-2 px-6 font-bodyMedium text-[12.5px] uppercase text-ink-faint">
          {title}
        </Text>
      ) : null}
      <View className="mx-4 overflow-hidden rounded-2xl bg-surface" style={shadows.soft}>
        {children}
      </View>
      {footer ? <Text className="mt-2 px-6 font-body text-xs leading-4 text-ink-faint">{footer}</Text> : null}
    </View>
  );
}

/** Rreshti: pllaka me ngjyrë, emri, shpjegimi i shkurtër dhe çelësi. Ndarësi nis pas ikonës, si te iPhone. */
function ToggleRow({
  icon, color, label, hint, value, disabled, last, onChange, children,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  last: boolean;
  onChange: (value: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row pl-4">
      <View className="mr-3.5 pt-3">
        <IconTile icon={icon} color={color} />
      </View>
      <View className={`flex-1 pr-4 ${last ? "" : "border-b border-cream-line"}`}>
        <View className="flex-row items-center py-2.5" style={{ minHeight: 54 }}>
          <View className="mr-3 flex-1">
            <Text className="font-bodyMedium text-[15.5px] text-ink">{label}</Text>
            {hint ? <Text className="mt-0.5 font-body text-xs leading-4 text-ink-faint">{hint}</Text> : null}
          </View>
          <ThemedSwitch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} />
        </View>
        {children}
      </View>
    </View>
  );
}

/** Hapi −/+ (orë): butona të rrumbullakët me ikonë, vlera në mes. */
function Stepper({
  label, value, text, onMinus, onPlus, minusDisabled, plusDisabled,
}: {
  label: string;
  value: string;
  text: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  const theme = useThemeColors();
  const btn = (kind: "-1" | "+1", onPress: () => void, off?: boolean) => (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={off}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${kind}`}
      className="h-8 w-8 items-center justify-center rounded-full bg-cream-soft"
      style={{ opacity: off ? 0.35 : 1 }}
    >
      {kind === "-1" ? <Minus size={15} color={theme.ink} strokeWidth={2.4} /> : <Plus size={15} color={theme.ink} strokeWidth={2.4} />}
    </Pressable>
  );
  return (
    <View className="flex-row items-center pb-3">
      <Text className="flex-1 font-body text-[13px] text-ink-soft">{text}</Text>
      {btn("-1", onMinus, minusDisabled)}
      <Text accessibilityLabel={`${label}: ${value}`} className="mx-2 w-16 text-center font-bodySemibold text-[15px] text-ink">
        {value}
      </Text>
      {btn("+1", onPlus, plusDisabled)}
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
  const quietOn = prefs.quietFrom !== prefs.quietTo;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("notif_title")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        {/* Çelësi kryesor */}
        <Group footer={t("notif_master_hint")}>
          <ToggleRow
            icon={Bell}
            color={C.red}
            label={t("notif_master")}
            value={pushOn}
            last
            onChange={(value) => setNotificationPref("push", value)}
          />
        </Group>

        {/* Orët e qeta: çelës, dhe kur është ndezur, "Nga" dhe "Deri" me hapa orësh */}
        <Group footer={t("notif_quiet_hint")} dim={!pushOn}>
          <ToggleRow
            icon={MoonStar}
            color={C.indigo}
            label={t("notif_quiet_title")}
            value={quietOn}
            disabled={!pushOn}
            last
            onChange={(on) => (on ? setQuietHours(22, 7) : setQuietHours(0, 0))}
          >
            {quietOn ? (
              <>
                <Stepper
                  label={t("notif_quiet_from")}
                  text={t("notif_quiet_from")}
                  value={hourLabel(prefs.quietFrom)}
                  onMinus={() => setQuietHours((prefs.quietFrom + 23) % 24, prefs.quietTo)}
                  onPlus={() => setQuietHours((prefs.quietFrom + 1) % 24, prefs.quietTo)}
                />
                <Stepper
                  label={t("notif_quiet_to")}
                  text={t("notif_quiet_to")}
                  value={hourLabel(prefs.quietTo)}
                  onMinus={() => setQuietHours(prefs.quietFrom, (prefs.quietTo + 23) % 24)}
                  onPlus={() => setQuietHours(prefs.quietFrom, (prefs.quietTo + 1) % 24)}
                />
              </>
            ) : null}
          </ToggleRow>
        </Group>

        {/* Grupet */}
        {NOTIFICATION_GROUPS.map(({ group, titleKey }) => {
          const entries = NOTIFICATION_CATALOG.filter((e) => e.group === group);
          return (
            <Group key={group} title={t(titleKey)} dim={!pushOn}>
              {entries.map((entry, i) => {
                const gapKind = GAP_KIND[entry.key];
                const gap = gapKind ? (gapKind === "feeding" ? prefs.feedingGapH : prefs.diaperGapH) : undefined;
                const enabled = isNotificationEnabled(prefs, entry.key);
                const label = t(entry.labelKey);
                return (
                  <ToggleRow
                    key={entry.key}
                    icon={TILE[entry.key].icon}
                    color={TILE[entry.key].color}
                    label={label}
                    hint={t(entry.hintKey, gap !== undefined ? { n: gap } : undefined)}
                    value={enabled}
                    disabled={!pushOn}
                    last={i === entries.length - 1}
                    onChange={(value) => setNotificationPref(entry.key, value)}
                  >
                    {gapKind && gap !== undefined && enabled && pushOn ? (
                      <Stepper
                        label={label}
                        text={t("notif_gap_label")}
                        value={t("notif_gap_hours", { n: gap })}
                        onMinus={() => setReminderGap(gapKind, gap - 1)}
                        onPlus={() => setReminderGap(gapKind, gap + 1)}
                        minusDisabled={gap <= REMINDER_GAP_MIN}
                        plusDisabled={gap >= REMINDER_GAP_MAX}
                      />
                    ) : null}
                  </ToggleRow>
                );
              })}
            </Group>
          );
        })}

        <Text className="px-6 font-body text-[11px] leading-4 text-ink-faint">{t("notif_permission_note")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
