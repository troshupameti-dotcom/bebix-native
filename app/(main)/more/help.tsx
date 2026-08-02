import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

const FAQS: { q: string; a: string }[] = [
  { q: "Si shtoj bebin tim te profili?", a: "Shko te Bebi → shtyp foton/emrin lart → plotëso emrin, datëlindjen dhe detajet e tjera." },
  { q: "A ruhen të dhënat e mia nëse mbyll app-in?", a: "Po — çdo gjë ruhet automatikisht në pajisjen tënde, dhe llogaria (email/fjalëkalim) ruhet nga Supabase." },
  { q: "Si aktivizoj kujtesat për vaksinat?", a: "Te secili vaksinim, aktivizo çelësin 'Kujtesë' — do të shfaqet te seksioni Kujtesat në Home." },
  { q: "A mund të kem disa bebe në të njëjtën llogari?", a: "Ende jo — kjo veçori (Bebet e Mia) po zhvillohet dhe do të aktivizohet së shpejti." },
  { q: "Si e ndryshoj gjuhën e app-it?", a: "Më Shumë → Gjuha → zgjidh Shqip ose English." },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Qendra e Ndihmës</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-bodySemibold text-xs text-ink-faint uppercase px-5 mb-2">Pyetje të Shpeshta</Text>
        <View className="px-5 mb-6">
          {FAQS.map((f, i) => (
            <View key={f.q} style={shadows.soft} className="bg-surface rounded-xl2 mb-3 overflow-hidden">
              <Pressable onPress={() => setOpen(open === i ? null : i)} className="flex-row items-center justify-between px-4 py-3.5">
                <Text className="font-bodyMedium text-sm text-ink flex-1 mr-2">{f.q}</Text>
                <Icon name={open === i ? "chevronLeft" : "chevronRight"} size={16} color="#A79D8A" />
              </Pressable>
              {open === i && (
                <View className="px-4 pb-4">
                  <Text className="font-body text-sm text-ink-soft leading-5">{f.a}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <Text className="font-bodySemibold text-xs text-ink-faint uppercase px-5 mb-2">Na kontakto</Text>
        <View className="px-5">
          <Pressable
            onPress={() => Linking.openURL("mailto:support@bebix.app?subject=Ndihmë%20Bebix")}
            style={shadows.soft}
            className="flex-row items-center bg-surface rounded-xl2 px-4 py-3.5 mb-3"
          >
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name="send" size={15} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">Dërgo Email</Text>
            <Icon name="chevronRight" size={16} color="#A79D8A" />
          </Pressable>
          <Text className="font-body text-xs text-ink-faint px-1">
            (Rregullo adresën "support@bebix.app" me email-in real që do të përdorësh)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}