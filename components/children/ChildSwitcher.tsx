import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Lock, Plus } from "lucide-react-native";
import { useChildren } from "@/lib/children/store";
import { requestChildSwitch } from "@/lib/children/switchRequest";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useToast } from "@/lib/toast/ToastContext";
import { haptics } from "@/lib/haptics";
import { AddChildSheet } from "@/components/children/AddChildSheet";
import { PremiumModal } from "@/components/children/PremiumModal";
import { childErrorMessage, childLabel } from "@/components/children/childActions";
import type { Child } from "@/lib/children/api";

/**
 * Zgjedhësi i fëmijës aktiv, lart në kreu: një çip për çdo fëmijë dhe "+" për të shtuar. Fëmija aktiv vendos
 * gjithçka tjetër. I kyçuri (pa Premium) tregon drynin dhe hap dritaren e Premium-it.
 * Shfaqet vetëm kur serveri e ka sistemin e fëmijëve.
 */
export function ChildSwitcher() {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const { mode, children, activeChildId } = useChildren();
  const [adding, setAdding] = useState(false);
  const [premium, setPremium] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  if (mode !== "ready") return null;

  async function pick(child: Child) {
    if (child.id === activeChildId || switching) return;
    haptics.select();
    if (child.isLocked) {
      setPremium(true);
      return;
    }
    setSwitching(child.id);
    try {
      await requestChildSwitch(child.id);
    } catch (e) {
      const msg = childErrorMessage(e);
      if (msg === "premium") setPremium(true);
      else showToast(t(msg));
    } finally {
      setSwitching(null);
    }
  }

  return (
    <View className="mb-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {children.map((child) => {
          const active = child.id === activeChildId;
          const label = childLabel(child, t("children_unnamed"));
          return (
            <Pressable
              key={child.id}
              onPress={() => pick(child)}
              accessibilityRole="button"
              accessibilityState={{ selected: active, busy: switching === child.id }}
              accessibilityLabel={child.isLocked ? `${label}, ${t("children_locked")}` : label}
              className={`flex-row items-center rounded-full px-3.5 py-2 ${active ? "bg-olive" : "bg-surface"}`}
            >
              <View
                className={`mr-2 h-6 w-6 items-center justify-center rounded-full ${active ? "bg-on-accent/20" : "bg-cream-soft"}`}
              >
                <Text className={`font-bodySemibold text-[12px] ${active ? "text-on-accent" : "text-ink"}`}>
                  {label.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text className={`font-bodyMedium text-[14px] ${active ? "text-on-accent" : "text-ink"}`} numberOfLines={1}>
                {label}
              </Text>
              {switching === child.id ? (
                <ActivityIndicator size="small" color={theme.inkSoft} style={{ marginLeft: 6 }} />
              ) : child.isLocked ? (
                <Lock size={13} color={theme.inkFaint} strokeWidth={2.2} style={{ marginLeft: 6 }} />
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            haptics.tap();
            setAdding(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("children_add")}
          className="flex-row items-center rounded-full border border-dashed border-ink/20 px-3.5 py-2"
        >
          <Plus size={15} color={theme.ink} strokeWidth={2.4} />
          <Text className="ml-1.5 font-bodyMedium text-[14px] text-ink">{t("children_add")}</Text>
        </Pressable>
      </ScrollView>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} onPremium={() => setPremium(true)} />
      <PremiumModal visible={premium} onClose={() => setPremium(false)} />
    </View>
  );
}
