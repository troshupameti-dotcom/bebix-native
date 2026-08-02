import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { postCatalog } from "@/lib/communityContent";

export default function SavedPostsScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const saved = postCatalog.filter((p) => state.community.savedPostIds.includes(p.id));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-2xl text-ink">Ruajtura</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {saved.length === 0 ? (
          <View className="items-center mt-16 px-8">
            <Icon name="bookmark" size={28} color="#A79D8A" />
            <Text className="font-body text-sm text-ink-soft mt-3 text-center">
              Ende s'ke ruajtur asnjë postim. Shtyp ikonën e "bookmark" te ndonjë postim për ta parë këtu.
            </Text>
          </View>
        ) : (
          <View className="px-5">
            {saved.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/community/post/${p.id}`)}
                style={shadows.soft}
                className="bg-surface rounded-xl2 p-4 mb-3"
              >
                <Text className="font-bodySemibold text-xs text-ink mb-1">{p.authorName}</Text>
                <Text className="font-body text-sm text-ink-soft" numberOfLines={2}>{p.text}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}