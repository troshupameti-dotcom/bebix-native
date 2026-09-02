import { View, Text, ScrollView, Pressable, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { supabase } from "@/lib/supabase/client";

type Row = {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: string;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View className="mb-6">
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{title}</Text>
      <View className="mx-5 bg-surface rounded-xl2 overflow-hidden" style={shadows.soft}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            className={`flex-row items-center px-4 py-3.5 ${i < rows.length - 1 ? "border-b border-cream-line" : ""}`}
          >
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name={r.icon} size={16} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">{r.label}</Text>
            {r.badge && (
              <View className="bg-cream-soft rounded-full px-2 py-0.5 mr-2">
                <Text className="font-bodySemibold text-[10px] text-ink-faint">{r.badge}</Text>
              </View>
            )}
            <Icon name="chevronRight" size={16} color="#A79D8A" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { profile } = state as any;

  // Defensive reads — these fields are set on AppState per the community feature build.
  // If the names differ in your actual AppStateContext, tell me and I'll adjust.
  const savedPostsCount = (state as any).savedPostIds?.length ?? 0;
  const joinedGroupsCount = (state as any).joinedGroupIds?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <Pressable
          onPress={() => router.push("/more/profile")}
          style={shadows.softLg}
          className="mx-5 mt-2 bg-surface rounded-xl3 p-5 mb-6"
        >
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center overflow-hidden mr-4">
              {profile?.parentPhoto ? (
                <Image source={{ uri: profile.parentPhoto }} className="w-16 h-16" />
              ) : (
                <Icon name="family" size={26} color="#6E7452" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-display text-xl text-ink">{profile?.parentName || "Shto emrin tënd"}</Text>
              <Text className="font-body text-xs text-ink-soft mt-0.5">Shiko dhe ndrysho profilin</Text>
            </View>
            <Icon name="chevronRight" size={18} color="#A79D8A" />
          </View>

          <View className="flex-row border-t border-cream-line pt-3">
            <View className="flex-1 items-center">
              <Text className="font-bodySemibold text-base text-ink">{savedPostsCount}</Text>
              <Text className="font-body text-[11px] text-ink-faint mt-0.5">Postime të Ruajtura</Text>
            </View>
            <View className="w-px bg-cream-line" />
            <View className="flex-1 items-center">
              <Text className="font-bodySemibold text-base text-ink">{joinedGroupsCount}</Text>
              <Text className="font-body text-[11px] text-ink-faint mt-0.5">Grupe të Bashkuara</Text>
            </View>
          </View>
        </Pressable>

        <Section
          title="Të Ruajturat"
          rows={[
            { icon: "heart", label: "Produkte të Ruajtura", onPress: () => router.push("/shop/wishlist") },
            { icon: "bookmark", label: "Postime të Ruajtura", onPress: () => router.push("/community/saved") },
          ]}
        />

        <Section
          title="Shëndeti"
          rows={[
            { icon: "shield", label: "Të Dhëna Mjekësore", onPress: () => router.push("/baby/medical") },
            { icon: "syringe", label: "Regjistrimet e Vaksinave", onPress: () => router.push("/baby/vaccinations") },
            { icon: "chart", label: "Raportet e Rritjes", onPress: () => router.push("/baby/growth") },
          ]}
        />

        <Section
          title="Cilësimet"
          rows={[
            { icon: "bell", label: "Njoftimet", onPress: () => router.push("/more/notifications") },
            { icon: "moon", label: "Pamja (Dark Mode)", onPress: () => router.push("/more/appearance") },
            { icon: "globe", label: "Gjuha", onPress: () => router.push("/more/language") },
          ]}
        />

        <Section
          title="Ndihmë"
          rows={[
            { icon: "comment", label: "Qendra e Ndihmës", onPress: () => router.push("/more/help") },
            { icon: "family", label: "Rreth Bebix", onPress: () => router.push("/more/about") },
            { icon: "lock", label: "Ligjore", onPress: () => router.push("/more/legal") },
          ]}
        />

        {/* Expert CTA — separate from settings list, so it reads as an invitation, not a menu item */}
        <Pressable
          onPress={() => router.push("/more/doctor-registration")}
          style={shadows.soft}
          className="mx-5 mb-6 bg-olive-bg rounded-xl2 p-4 flex-row items-center"
        >
          <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="shield" size={18} color="#6E7452" />
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-sm text-ink">Je mjek apo ekspert i fëmijëve?</Text>
            <Text className="font-body text-xs text-ink-soft mt-0.5">Bëhu ekspert i verifikuar në Bebix</Text>
          </View>
          <Icon name="chevronRight" size={16} color="#6E7452" />
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert("Dil nga llogaria", "A je i sigurt?", [
              { text: "Anulo", style: "cancel" },
              {
                text: "Dil",
                style: "destructive",
                onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace("/(auth)/login");
                },
              },
            ])
          }
          className="items-center py-3"
        >
          <Text className="font-bodyMedium text-sm text-orange">Dil nga Llogaria</Text>
        </Pressable>

        <Text className="font-body text-[11px] text-ink-faint text-center mt-4">Bebix v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}