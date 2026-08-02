import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

const DOCS: { title: string; body: string }[] = [
  {
    title: "Kushtet e Përdorimit",
    body: "Duke përdorur Bebix, pranon të mos ngarkosh përmbajtje të paligjshme, të respektosh privatësinë e prindërve të tjerë në Komunitet, dhe të mos përdorësh të dhënat e ofruara nga app-i (përfshirë sugjerimet e AI) si zëvendësim të këshillës mjekësore profesionale.",
  },
  {
    title: "Politika e Privatësisë",
    body: "Bebix ruan të dhënat që fut vetë (emri i bebit, matje, regjistrime) në pajisjen tënde dhe/ose në Supabase, ofruesin tonë të bazës së të dhënave. S'i shesim të dhënat e tua palëve të treta. Mund të kërkosh eksportimin ose fshirjen e plotë të të dhënave tua në çdo kohë.",
  },
  {
    title: "Politika e Cookies",
    body: "Versioni mobile i Bebix aktualisht s'përdor cookies të shfletuesit. Nëse në të ardhmen shtohet një version web, kjo politikë do të përditësohet përkatësisht.",
  },
  {
    title: "Përjashtimi Mjekësor (Medical Disclaimer)",
    body: "Bebix ofron informacion të përgjithshëm edukativ, jo këshillë mjekësore. Kujtesat, rekomandimet dhe përmbajtja e AI-t s'zëvendësojnë vlerësimin e një mjeku. Për shqetësime shëndetësore, kontakto gjithmonë pediatrin.",
  },
  {
    title: "Përjashtimi i AI-t",
    body: "Përmbajtja e gjeneruar nga funksione 'AI' brenda Bebix bazohet në të dhënat që fut vetë dhe/ose modele gjuhësore të palëve të treta. Mund të përmbajë pasaktësi — përdore si udhëzim, jo si fakt absolut.",
  },
  {
    title: "Rregullat e Komunitetit",
    body: "Respekt reciprok, pa gjuhë urrejtjeje, pa reklamim të paautorizuar, pa këshilla mjekësore të paverifikuara të paraqitura si fakte. Postimet që shkelin rregullat mund të hiqen dhe llogaritë të pezullohen.",
  },
  {
    title: "Politika e Rimbursimit",
    body: "Për blerjet nga Shop-i (kur të aktivizohet checkout real), rimbursimet do të trajtohen sipas kushteve të secilit shitës/partner, të specifikuara në faqen e produktit përpara blerjes.",
  },
  {
    title: "Mbrojtja e të Dhënave (GDPR-Ready)",
    body: "Arkitektura e Bebix synon përputhshmëri me GDPR: e drejta për akses, korrigjim, eksportim (\"portabilitet\") dhe fshirje ('e drejta për t'u harruar') do të mbështeten plotësisht kur backend-i qendror të jetë gati.",
  },
  {
    title: "Privatësia e Fëmijëve",
    body: "Bebix përpunon të dhëna për fëmijë (bebe) të futura nga prindërit/kujdestarët e tyre ligjorë, jo drejtpërdrejt nga fëmija. Llogaria e app-it krijohet dhe kontrollohet nga një i rritur.",
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Ligjore</Text>
      </View>

      <View className="mx-5 mb-4 bg-orange-bg rounded-xl2 p-3" style={shadows.soft}>
        <Text className="font-bodySemibold text-xs text-ink mb-1">⚠️ Draft — jo këshillë ligjore</Text>
        <Text className="font-body text-xs text-ink-soft leading-5">
          Tekstet më poshtë janë draft fillestar për t'u parë si strukturë. Përpara se t'i publikosh (App Store/Play Store), duhen shqyrtuar nga një jurist, sepse kërkesat ligjore ndryshojnë sipas vendit dhe llojit të të dhënave që përpunon.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5">
          {DOCS.map((doc, i) => (
            <View key={doc.title} style={shadows.soft} className="bg-surface rounded-xl2 mb-3 overflow-hidden">
              <Pressable onPress={() => setOpenIndex(openIndex === i ? null : i)} className="flex-row items-center justify-between px-4 py-3.5">
                <Text className="font-bodySemibold text-sm text-ink flex-1 mr-2">{doc.title}</Text>
                <Icon name={openIndex === i ? "chevronLeft" : "chevronRight"} size={16} color="#A79D8A" />
              </Pressable>
              {openIndex === i && (
                <View className="px-4 pb-4">
                  <Text className="font-body text-sm text-ink-soft leading-6">{doc.body}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}