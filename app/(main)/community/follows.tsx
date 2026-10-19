import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar } from "@/components/community/PostCard";
import { fetchFollowList, type FollowPerson } from "@/lib/community/messages";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";

type Kind = "followers" | "following";

/**
 * Ndjekësit / të ndjekurit e një personi, me dy skeda. Listat i sheh vetë personi dhe miqtë e tij (ndiqni
 * njëri-tjetrin); të tjerët shohin vetëm një shënim (numrat janë te profili).
 */
export default function FollowsScreen() {
  const params = useLocalSearchParams<{ user: string; kind?: string; name?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [kind, setKind] = useState<Kind>(params.kind === "following" ? "following" : "followers");
  const [state, setState] = useState<{ allowed: boolean; people: FollowPerson[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (k: Kind) => {
      if (!params.user) return;
      setState(null);
      setFailed(false);
      try {
        setState(await fetchFollowList(params.user, k));
      } catch {
        setFailed(true);
      }
    },
    [params.user]
  );

  useFocusEffect(
    useCallback(() => {
      void load(kind);
    }, [load, kind])
  );

  const tabs: { key: Kind; label: string }[] = [
    { key: "followers", label: t("cprof_followers") },
    { key: "following", label: t("cprof_following") },
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pb-2 pt-2">
        <BackButton fallback="/(main)/community" className="mr-2" />
        <Text className="flex-1 font-display text-xl text-ink" numberOfLines={1}>
          {params.name ?? ""}
        </Text>
      </View>

      <View className="mx-5 mb-2 flex-row rounded-full bg-cream-soft p-1" accessibilityRole="tablist">
        {tabs.map((tb) => (
          <Pressable
            key={tb.key}
            onPress={() => {
              haptics.select();
              setKind(tb.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === tb.key }}
            className={`flex-1 items-center rounded-full py-2 ${kind === tb.key ? "bg-ink" : ""}`}
          >
            <Text className={`font-bodyMedium text-xs ${kind === tb.key ? "text-on-accent" : "text-ink-soft"}`}>{tb.label}</Text>
          </Pressable>
        ))}
      </View>

      {state === null && !failed ? <ActivityIndicator className="mt-10" color={theme.inkSoft} /> : null}
      {failed ? <Text className="mt-10 px-8 text-center font-body text-sm text-ink-soft">{t("community_load_failed_title")}</Text> : null}
      {state && !state.allowed ? (
        <View className="mt-12 items-center px-10">
          <Lock size={28} color={theme.inkFaint} strokeWidth={2} />
          <Text className="mt-3 text-center font-body text-sm leading-5 text-ink-soft">{t("follows_private")}</Text>
        </View>
      ) : null}
      {state?.allowed ? (
        <FlatList
          data={state.people}
          keyExtractor={(p) => p.userId}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <Text className="mt-10 px-8 text-center font-body text-sm text-ink-soft">
              {t(kind === "followers" ? "follows_empty_followers" : "follows_empty_following")}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push(`/community/user/${item.userId}`);
              }}
              accessibilityRole="button"
              className="flex-row items-center px-5 py-2.5"
              style={({ pressed }) => ({ minHeight: 60, opacity: pressed ? 0.7 : 1 })}
            >
              <Avatar initial={item.name.trim().charAt(0).toUpperCase() || "?"} accent="olive" size={44} userId={item.userId} />
              <Text className="ml-3 flex-1 font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}
