import { View, Text, ScrollView, Pressable, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

type Row = {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: string;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View className="mb-6">
      <Text className="font-bodySemibold text-xs text-ink-faint uppercase px-5 mb-2">{title}</Text>
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
  const { profile } = state;

  const soon = (title: string, reason?: string, icon?: string) =>
    router.push({ pathname: "/more/soon", params: { title, reason, icon } });

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-display text-2xl text-ink px-5 pt-2 mb-5">Më Shumë</Text>

        {/* Profile card */}
        <Pressable
          onPress={() => router.push("/more/profile")}
          style={shadows.softLg}
          className="mx-5 bg-surface rounded-xl3 p-4 flex-row items-center mb-6"
        >
          <View className="w-14 h-14 rounded-full bg-olive-bg items-center justify-center overflow-hidden mr-4">
            {profile.parentPhoto ? (
              <Image source={{ uri: profile.parentPhoto }} className="w-14 h-14" />
            ) : (
              <Icon name="family" size={24} color="#6E7452" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-base text-ink">{profile.parentName || "Shto emrin tënd"}</Text>
            <Text className="font-body text-xs text-ink-soft">Shiko dhe ndrysho profilin</Text>
          </View>
          <Icon name="chevronRight" size={18} color="#A79D8A" />
        </Pressable>

        <Section
          title="Llogaria ime"
          rows={[
            { icon: "baby", label: "Bebet e Mia", onPress: () => soon("Bebet e Mia", "Mbështetja për disa bebe njëherësh kërkon ndryshim strukturor te modeli i të dhënave — vjen te faza tjetër.") },
            { icon: "family", label: "Anëtarët e Familjes", onPress: () => soon("Anëtarët e Familjes", "Ndarja e llogarisë me role (mami, babi, gjyshërit...) kërkon Supabase.") },
            { icon: "cube", label: "Porositë", onPress: () => soon("Porositë", "Historiku i porosive kërkon checkout dhe backend real.") },
            { icon: "heart", label: "Wishlist", onPress: () => router.push("/shop/wishlist") },
            { icon: "bookmark", label: "Postime të Ruajtura", onPress: () => router.push("/community/saved") },
            { icon: "sparkle", label: "Historiku i AI-t", onPress: () => soon("Historiku i AI-t", "Ende s'ka integrim real AI me histori bisedash.") },
          ]}
        />

        <Section
          title="Shëndeti"
          rows={[
            { icon: "shield", label: "Të Dhëna Mjekësore", onPress: () => router.push("/baby/medical") },
            { icon: "syringe", label: "Regjistrimet e Vaksinave", onPress: () => router.push("/baby/vaccinations") },
            { icon: "chart", label: "Raportet e Rritjes", onPress: () => router.push("/baby/growth") },
            { icon: "download", label: "Dokumente", onPress: () => soon("Dokumente", "Ngarkimi/ruajtja e dokumenteve kërkon Supabase Storage.") },
          ]}
        />

        <Section
          title="Cilësimet"
          rows={[
            { icon: "bell", label: "Njoftimet", onPress: () => router.push("/more/notifications") },
            { icon: "moon", label: "Pamja (Dark Mode)", onPress: () => router.push("/more/appearance") },
            { icon: "globe", label: "Gjuha", onPress: () => router.push("/more/language"), badge: state.darkMode ? undefined : undefined },
            { icon: "lock", label: "Privatësia", onPress: () => soon("Privatësia", "Kontrollet e privatësisë kërkojnë llogari dhe të dhëna të ruajtura në server.") },
            { icon: "shield", label: "Siguria", onPress: () => soon("Siguria", "Face ID/2FA kërkojnë 'development build' (jashtë Expo Go) dhe/ose backend.") },
            { icon: "sparkle", label: "Cilësimet e AI", onPress: () => soon("Cilësimet e AI", "Ende s'ka motor AI real të lidhur me app-in.") },
          ]}
        />

        <Section
          title="Premium"
          rows={[
            { icon: "flame", label: "Bebix Premium", onPress: () => soon("Bebix Premium", "Abonimet reale kërkojnë RevenueCat/Stripe dhe App Store/Play Store setup.") },
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

        <View className="mx-5 mt-2">
          <Pressable
            onPress={() =>
              Alert.alert("Dil nga llogaria", "A je i sigurt?", [
                { text: "Anulo", style: "cancel" },
                {
                  text: "Dil",
                  style: "destructive",
                  onPress: () => {
                    // ⚠️ Rregullo importin sipas rrugës reale të klientit Supabase
                    // te projekti yt, p.sh.: import { supabase } from "@/lib/supabase";
                    // supabase.auth.signOut().then(() => router.replace("/(auth)/login"));
                    Alert.alert("Lidhe Supabase-in", "Shto thirrjen reale supabase.auth.signOut() këtu — shiko komentin te kodi.");
                  },
                },
              ])
            }
            style={shadows.soft}
            className="bg-surface rounded-xl2 py-3.5 items-center"
          >
            <Text className="font-bodySemibold text-sm text-orange">Dil nga Llogaria</Text>
          </Pressable>
        </View>

        <Text className="font-body text-[11px] text-ink-faint text-center mt-6">Bebix v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}