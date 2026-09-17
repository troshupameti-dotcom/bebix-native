import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { shadows } from "@/lib/shadows";
import { fetchMyApplication, submitApplication, ExpertApplication } from "@/lib/expertApplications";

const SPECIALIZATIONS = ["Pediatër", "Nutricionist", "Konsulente Gjidhënieje", "Psikolog Fëmijësh", "Trajner Gjumi"];

function StatusBanner({ app }: { app: ExpertApplication }) {
  const config = {
    pending: { bg: "bg-olive-bg", fg: "text-olive", label: "Në pritje të aprovimit" },
    approved: { bg: "bg-olive-bg", fg: "text-olive", label: "I aprovuar ✓" },
    rejected: { bg: "bg-orange-bg", fg: "text-orange", label: "I refuzuar" },
  }[app.status];
  return (
    <View style={shadows.soft} className={`rounded-xl2 p-4 mb-5 ${config.bg}`}>
      <Text className={`font-bodySemibold text-sm mb-1 ${config.fg}`}>{config.label}</Text>
      <Text className="font-body text-xs text-ink-soft mb-1">{app.fullName} · {app.specialization}</Text>
      <Text className="font-body text-[11px] text-ink-faint">Licenca: {app.licenseNumber}</Text>
      {app.adminNote && (
        <Text className="font-body text-xs text-ink-soft mt-2">Shënim admin: {app.adminNote}</Text>
      )}
    </View>
  );
}

export default function DoctorRegistrationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<ExpertApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0]);
  const [experienceYears, setExperienceYears] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      fetchMyApplication()
        .then((app) => { if (alive) setExisting(app); })
        .catch((e) => { if (alive) setError(String(e.message ?? e)); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, [])
  );

  const canSubmit = fullName.trim() && licenseNumber.trim() && phone.trim() && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitApplication({
        fullName: fullName.trim(),
        licenseNumber: licenseNumber.trim(),
        specialization,
        experienceYears: Number(experienceYears) || 0,
        phone: phone.trim(),
        bio: bio.trim(),
      });
      const app = await fetchMyApplication();
      setExisting(app);
    } catch (e: any) {
      setError(e.message ?? "Gabim gjatë dërgimit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-display text-xl text-ink ml-1">Regjistrohu si Mjek</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {existing && existing.status !== "rejected" ? (
            <StatusBanner app={existing} />
          ) : (
            <>
              {existing?.status === "rejected" && <StatusBanner app={existing} />}

              <Text className="font-body text-xs text-ink-soft mb-5 leading-5">
                Plotëso të dhënat e sakta — aplikimi shqyrtohet manualisht nga ekipi ynë para se me u shfaq si “ekspert i verifikuar” në Komunitet.
              </Text>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Emri i plotë</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={fullName} onChangeText={setFullName} placeholder="Dr. Emri Mbiemri" placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Numri i licencës mjekësore</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={licenseNumber} onChangeText={setLicenseNumber} placeholder="p.sh. LMK-2024-0891" placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Specializimi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }} className="mb-4">
                {SPECIALIZATIONS.map((s) => {
                  const active = specialization === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSpecialization(s)}
                      style={shadows.soft}
                      className={`rounded-full px-4 py-2 mr-2 ${active ? "bg-olive" : "bg-surface"}`}
                    >
                      <Text className={`font-bodyMedium text-xs ${active ? "text-on-accent" : "text-ink"}`}>{s}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Vite përvoje</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" placeholder="p.sh. 8" placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Numri i telefonit</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+383 4X XXX XXX" placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">Pak fjalë për veten (opsionale)</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-6">
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Klinika, fusha e fokusit, gjuhët që flet..."
                  placeholderClassName="text-ink-faint"
                  multiline
                  className="font-body text-sm text-ink min-h-[70px]"
                  textAlignVertical="top"
                />
              </View>

              {error && <Text className="font-body text-xs text-orange mb-4">{error}</Text>}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                className={`py-3.5 rounded-full items-center ${canSubmit ? "bg-olive" : "bg-cream-line"}`}
              >
                {submitting ? (
                  <ActivityIndicator className="text-on-accent" />
                ) : (
                  <Text className={`font-bodySemibold text-sm ${canSubmit ? "text-on-accent" : "text-ink-faint"}`}>
                    {existing?.status === "rejected" ? "Apliko Përsëri" : "Dërgo Aplikimin"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}