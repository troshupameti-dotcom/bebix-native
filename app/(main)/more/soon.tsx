import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

/**
 * Ekran i përbashkët për çdo seksion të "More" që s'mund të jetë ende
 * funksional (kërkon Supabase, pagesa reale, ose module native jashtë
 * Expo Go). Trajtohet me ndershmëri — jo si buton që s'bën asgjë.
 */
export default function ComingSoonScreen() {
  const router = useRouter();
  const { title, reason, icon } = useLocalSearchParams<{ title: string; reason?: string; icon?: string }>();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{title}</Text>
      </View>

      <View className="items-center px-8 mt-16">
        <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
          <Icon name={(icon as IconName) || "lock"} size={26} color="#6E7452" />
        </View>
        <Text className="font-bodySemibold text-base text-ink mb-2 text-center">Së shpejti</Text>
        <Text className="font-body text-sm text-ink-soft text-center leading-5">
          {reason || "Kjo pjesë kërkon lidhje me backend (Supabase) ose shërbime shtesë përpara se të jetë plotësisht funksionale."}
        </Text>
      </View>
    </SafeAreaView>
  );
}