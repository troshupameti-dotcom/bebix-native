import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { shadows } from "@/lib/shadows";
import { fetchMyApplication, submitApplication, ExpertApplication } from "@/lib/expertApplications";
import { BackButton } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { friendlyError } from "@/lib/errors/userMessage";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";

function StatusBanner({ app }: { app: ExpertApplication }) {
  const { t, language } = useTranslation();
  const { list } = useSpecialties();
  const dept = specialtyLabel(app.specialtyKey, language, list) ?? app.specialization;
  const config = {
    pending: { bg: "bg-olive-bg", fg: "text-olive", label: t("doc_status_pending") },
    approved: { bg: "bg-olive-bg", fg: "text-olive", label: t("doc_status_approved") },
    rejected: { bg: "bg-orange-bg", fg: "text-orange", label: t("doc_status_rejected") },
  }[app.status];
  return (
    <View style={shadows.soft} className={`rounded-xl2 p-4 mb-5 ${config.bg}`}>
      <Text className={`font-bodySemibold text-sm mb-1 ${config.fg}`}>{config.label}</Text>
      <Text className="font-body text-xs text-ink-soft mb-1">{app.fullName} · {dept}</Text>
      <Text className="font-body text-[11px] text-ink-faint">{t("doc_license_label", { n: app.licenseNumber })}</Text>
      {app.adminNote && (
        <Text className="font-body text-xs text-ink-soft mt-2">{t("doc_admin_note", { note: app.adminNote })}</Text>
      )}
    </View>
  );
}

export default function DoctorRegistrationScreen() {
  const { t, language } = useTranslation();
  const specialties = useSpecialties();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<ExpertApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  // Reparti zgjidhet me dorë (asnjë parazgjedhje): aplikimi pa reparte nuk dërgohet.
  const [specialtyKey, setSpecialtyKey] = useState<string | null>(null);
  const [experienceYears, setExperienceYears] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      fetchMyApplication()
        .then((app) => { if (alive) setExisting(app); })
        .catch((e) => { if (alive) setError(friendlyError(e, t, "err_generic")); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, [t])
  );

  const canSubmit = fullName.trim() && licenseNumber.trim() && phone.trim() && specialtyKey && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !specialtyKey) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitApplication({
        fullName: fullName.trim(),
        licenseNumber: licenseNumber.trim(),
        specialization: specialtyLabel(specialtyKey, "sq", specialties.list) ?? specialtyKey,
        specialtyKey,
        experienceYears: Number(experienceYears) || 0,
        phone: phone.trim(),
        bio: bio.trim(),
      });
      const app = await fetchMyApplication();
      setExisting(app);
    } catch (e: any) {
      setError(friendlyError(e, t, "doc_send_failed"));
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
        <BackButton fallback="/(main)/more" />
        <Text className="font-display text-xl text-ink ml-1">{t("doc_title")}</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {existing && existing.status !== "rejected" ? (
            <StatusBanner app={existing} />
          ) : (
            <>
              {existing?.status === "rejected" && <StatusBanner app={existing} />}

              <Text className="font-body text-xs text-ink-soft mb-5 leading-5">
                {t("doc_intro")}
              </Text>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">{t("doc_full_name")}</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={fullName} onChangeText={setFullName} placeholder={t("doc_ph_name")} placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">{t("doc_license")}</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={licenseNumber} onChangeText={setLicenseNumber} placeholder={t("doc_ph_license")} placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1">{t("doc_specialty")}</Text>
              <Text className="font-body text-[11px] text-ink-faint mb-2 leading-4">{t("doc_dept_hint")}</Text>
              {/* Repartet (pediatër, gjinekolog/e, ortoped, psikolog/e, ...) si një rrjet që mbështillet: të gjitha shihen njëherësh. */}
              <View className="flex-row flex-wrap mb-4">
                {specialties.list.map((s) => {
                  const active = specialtyKey === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => setSpecialtyKey(s.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={shadows.soft}
                      className={`flex-row items-center rounded-full px-3.5 py-2 mr-2 mb-2 ${active ? "bg-olive" : "bg-surface"}`}
                    >
                      <Text className="text-sm mr-1.5">{s.emoji}</Text>
                      <Text className={`font-bodyMedium text-xs ${active ? "text-on-accent" : "text-ink"}`}>
                        {language === "en" ? s.labelEn : s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">{t("doc_years")}</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" placeholder={t("doc_ph_years")} placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">{t("doc_phone")}</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-4">
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t("doc_ph_phone")} placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
              </View>

              <Text className="font-bodySemibold text-xs text-ink-soft mb-1.5">{t("doc_bio")}</Text>
              <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-6">
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t("doc_ph_bio")}
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
                    {existing?.status === "rejected" ? t("doc_reapply") : t("doc_submit")}
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