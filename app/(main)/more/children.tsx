import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Lock, Plus } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { AddChildSheet } from "@/components/children/AddChildSheet";
import { PremiumModal } from "@/components/children/PremiumModal";
import { childErrorMessage, childLabel } from "@/components/children/childActions";
import { setFreeChildRemote, type Child } from "@/lib/children/api";
import { resolveChildren } from "@/lib/children/resolve";
import { useChildren } from "@/lib/children/store";
import { requestChildSwitch } from "@/lib/children/switchRequest";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useToast } from "@/lib/toast/ToastContext";
import { computeAgeText } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";

function Badge({ text, tone }: { text: string; tone: "accent" | "soft" }) {
  return (
    <View className={`ml-2 rounded-full px-2 py-0.5 ${tone === "accent" ? "bg-olive" : "bg-cream-soft"}`}>
      <Text className={`font-bodyMedium text-[11px] ${tone === "accent" ? "text-on-accent" : "text-ink-soft"}`}>{text}</Text>
    </View>
  );
}

/**
 * Fëmijët e familjes: cili është aktiv, cili falas, cilët të kyçur. Prindi kalon te një fëmijë, shton një të ri, dhe
 * (pronari i llogarisë) ndërron fëmijën falas kur ka gabuar. Asgjë s'fshihet nga ky ekran.
 */
export default function ChildrenScreen() {
  const { t, lang } = useTranslation();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const me = useCurrentUserId();
  const { mode, children, activeChildId } = useChildren();
  const [adding, setAdding] = useState(false);
  const [premium, setPremium] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void resolveChildren({ force: true }).catch(() => {});
    }, [])
  );

  function fail(e: unknown) {
    const msg = childErrorMessage(e);
    if (msg === "premium") setPremium(true);
    else showToast(t(msg));
  }

  async function open(child: Child) {
    if (child.id === activeChildId || busy) return;
    if (child.isLocked) {
      setPremium(true);
      return;
    }
    setBusy(child.id);
    try {
      await requestChildSwitch(child.id);
      haptics.success();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  function makeFree(child: Child) {
    const name = childLabel(child, t("children_unnamed"));
    Alert.alert(t("children_make_free_title", { name }), t("children_make_free_body"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("children_make_free"),
        onPress: async () => {
          setBusy(child.id);
          try {
            await setFreeChildRemote(child.id);
            await resolveChildren({ force: true });
            haptics.success();
            showToast(t("children_make_free_done", { name }));
          } catch (e) {
            fail(e);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("children_title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}>
        <Text className="mb-4 px-2 font-body text-[13px] leading-5 text-ink-soft">{t("children_hint")}</Text>

        {mode === "unknown" ? <ActivityIndicator color={theme.inkSoft} /> : null}

        <View className="overflow-hidden rounded-2xl bg-surface" style={shadows.soft}>
          {children.map((child, i) => {
            const label = childLabel(child, t("children_unnamed"));
            const active = child.id === activeChildId;
            const age = child.birthDate ? computeAgeText(child.birthDate, lang) : "";
            const canMakeFree = !child.isFree && child.ownerId === me;
            return (
              <View key={child.id} className={`px-4 py-3 ${i === children.length - 1 ? "" : "border-b border-cream-line"}`}>
                <Pressable
                  onPress={() => open(child)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, busy: busy === child.id }}
                  accessibilityLabel={[label, age, child.isFree ? t("children_free_badge") : "", child.isLocked ? t("children_locked") : ""]
                    .filter(Boolean)
                    .join(", ")}
                  className="flex-row items-center"
                >
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-cream-soft">
                    <Text className="font-bodySemibold text-[16px] text-ink">{label.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center">
                      <Text className="font-bodySemibold text-[15.5px] text-ink">{label}</Text>
                      {active ? <Badge text={t("children_active")} tone="accent" /> : null}
                      {child.isFree ? <Badge text={t("children_free_badge")} tone="soft" /> : null}
                    </View>
                    {age ? <Text className="mt-0.5 font-body text-xs text-ink-faint">{age}</Text> : null}
                  </View>
                  {busy === child.id ? (
                    <ActivityIndicator color={theme.inkSoft} />
                  ) : child.isLocked ? (
                    <Lock size={16} color={theme.inkFaint} strokeWidth={2.2} />
                  ) : null}
                </Pressable>
                {canMakeFree ? (
                  <Pressable
                    onPress={() => makeFree(child)}
                    disabled={!!busy}
                    accessibilityRole="button"
                    className="ml-[52px] mt-2 self-start rounded-full bg-cream-soft px-3 py-1.5"
                  >
                    <Text className="font-bodyMedium text-[12.5px] text-ink">{t("children_make_free")}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        {mode === "ready" ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              setAdding(true);
            }}
            accessibilityRole="button"
            className="mt-4 flex-row items-center justify-center rounded-2xl border border-dashed border-ink/20 py-3.5"
          >
            <Plus size={16} color={theme.ink} strokeWidth={2.4} />
            <Text className="ml-2 font-bodySemibold text-[15px] text-ink">{t("children_add")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <AddChildSheet visible={adding} onClose={() => setAdding(false)} onPremium={() => setPremium(true)} />
      <PremiumModal visible={premium} onClose={() => setPremium(false)} />
    </SafeAreaView>
  );
}
