import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { CommunityTip } from "@/lib/communityData";
import { GameSuggestion } from "@/lib/aiGameRecommendations";

type Tab = "tip" | "games";

export function TodayCard({
  tip,
  games,
  gamesLoading,
  gamesError,
  hasAge,
  onRetryGames,
}: {
  tip: CommunityTip | null;
  games: GameSuggestion[];
  gamesLoading: boolean;
  gamesError: string | null;
  hasAge: boolean;
  onRetryGames: () => void;
}) {
  const [tab, setTab] = useState<Tab>("tip");

  return (
    <View style={shadows.soft} className="mx-5 bg-surface rounded-xl3 p-4 mb-2">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-bodySemibold text-sm text-ink">Sot</Text>
        <View className="flex-row bg-cream-soft rounded-full p-1">
          <Pressable onPress={() => setTab("tip")} className={`px-3 py-1 rounded-full ${tab === "tip" ? "bg-olive" : ""}`}>
            <Text className={`font-bodyMedium text-[11px] ${tab === "tip" ? "text-white" : "text-ink-soft"}`}>Këshillë</Text>
          </Pressable>
          <Pressable onPress={() => setTab("games")} className={`px-3 py-1 rounded-full ${tab === "games" ? "bg-olive" : ""}`}>
            <Text className={`font-bodyMedium text-[11px] ${tab === "games" ? "text-white" : "text-ink-soft"}`}>Lojëra AI</Text>
          </Pressable>
        </View>
      </View>

      {tab === "tip" ? (
        tip ? (
          <View className="flex-row">
            <View className="w-9 h-9 rounded-full bg-olive-bg items-center justify-center mr-3">
              <Icon name={tip.icon} size={16} color="#6E7452" />
            </View>
            <View className="flex-1">
              <Text className="font-bodySemibold text-xs text-ink mb-1">{tip.title}</Text>
              <Text className="font-body text-xs text-ink-soft leading-5">{tip.body}</Text>
            </View>
          </View>
        ) : (
          <Text className="font-body text-xs text-ink-faint">Ende s'ka këshilla.</Text>
        )
      ) : !hasAge ? (
        <Text className="font-body text-xs text-ink-faint">Shto datëlindjen e bebit n'Profil me marrë lojra t'personalizueme.</Text>
      ) : gamesLoading ? (
        <ActivityIndicator color="#6E7452" />
      ) : gamesError ? (
        <View>
          <Text className="font-body text-xs text-orange mb-2">{gamesError}</Text>
          <Pressable onPress={onRetryGames}><Text className="font-bodyMedium text-xs text-olive">Provo prap</Text></Pressable>
        </View>
      ) : games.length === 0 ? (
        <Text className="font-body text-xs text-ink-faint">S'ka lojra ende.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {games.map((g, i) => (
            <View key={i} style={shadows.soft} className="w-56 bg-cream rounded-xl2 p-3 mr-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="font-bodySemibold text-xs text-ink flex-1" numberOfLines={2}>{g.title}</Text>
                <View className="bg-olive-bg rounded-full px-2 py-0.5 ml-2">
                  <Text className="font-bodyMedium text-[10px] text-olive">{g.durationMin} min</Text>
                </View>
              </View>
              <Text className="font-body text-[11px] text-ink-soft leading-4 mb-1.5">{g.description}</Text>
              <Text className="font-bodyMedium text-[10px] text-olive">✨ {g.benefit}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}