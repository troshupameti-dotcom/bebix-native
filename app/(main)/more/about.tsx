import { View, Text, ScrollView, Pressable, Share, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

function ActionRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-4 py-3.5 border-b border-cream-line">
      <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
        <Icon name={icon} size={16} color="#6E7452" />
      </View>
      <Text className="font-bodyMedium text-sm text-ink flex-1">{label}</Text>
      <Icon name="chevronRight" size={16} color="#A79D8A" />
    </Pressable>
  );
}

export default function AboutScreen() {
  const router = useRouter();

  const shareApp = () => {
    Share.share({ message: "Provo Bebix — aplikacioni që më ndihmon të ndjek gjithçka për bebin tim! " });
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-5">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Rreth Bebix</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 mb-6">
          <View style={shadows.soft} className="bg-olive-bg rounded-xl2 p-5">
            <Text className="font-bodySemibold text-lg text-ink mb-2">Misioni Ynë</Text>
            <Text className="font-body text-sm text-ink-soft leading-6 mb-4">
              Bebix ekziston për t'i ndihmuar prindërit të ndjekin çdo hap të rritjes së bebit të tyre me qetësi mendore — nga ushqyerja dhe gjumi, te vaksinat dhe momentet e para — të gjitha në një vend të vetëm, të krijuar me kujdes.
            </Text>
            <Text className="font-bodySemibold text-lg text-ink mb-2">Vizioni Ynë</Text>
            <Text className="font-body text-sm text-ink-soft leading-6">
              Të bëhemi shoqëruesi më i besuar i çdo familjeje në rrugëtimin e prindërimit — duke kombinuar teknologji të thjeshtë me përvojë njerëzore reale.
            </Text>
          </View>
        </View>

        <View className="px-5 mb-6">
          <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden">
            <ActionRow icon="sparkle" label="Vlerëso Bebix" onPress={() => { /* Linking.openURL(url-i i App Store/Play Store kur të publikohet) */ }} />
            <ActionRow icon="share" label="Ndaj Bebix me Miq" onPress={shareApp} />
            <ActionRow icon="globe" label="Website" onPress={() => { /* Linking.openURL("https://bebix.app") — vendos domain-in real */ }} />
          </View>
        </View>

        <View className="px-5">
          <Text className="font-body text-xs text-ink-faint text-center">Versioni 1.0.0 (Build 1)</Text>
          <Text className="font-body text-xs text-ink-faint text-center mt-1">© 2026 Bebix. Të gjitha të drejtat e rezervuara.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}