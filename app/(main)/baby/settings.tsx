import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Image, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "@/components/ui/Icon";
import { FormField } from "@/components/baby/FormField";
import { SegmentedField } from "@/components/baby/SegmentedField";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { BabyGender, BloodType } from "@/lib/state/types";

const GENDERS: BabyGender[] = ["girl", "boy", "other"];
const BLOOD_TYPES: BloodType[] = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export default function BabySettingsScreen() {
  const { t } = useTranslation();
  const { state, updateProfile, baby, resetBabyData } = useAppState();
  const { profile } = state;

  const [name, setName] = useState(profile.babyName ?? "");
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [dob, setDob] = useState(profile.babyDob ? profile.babyDob.slice(0, 10) : "");
  const [gender, setGender] = useState<BabyGender>(profile.babyGender);
  const [bloodType, setBloodType] = useState<BloodType>(profile.bloodType);
  const [allergies, setAllergies] = useState(profile.allergies);
  const [pediatrician, setPediatrician] = useState(profile.pediatrician);
  const [medicalNotes, setMedicalNotes] = useState(profile.medicalNotes);
  const [parentNotes, setParentNotes] = useState(profile.parentNotes);

  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  async function pickPhoto() {
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) updateProfile({ babyPhoto: result.assets[0].uri });
  }

  function save() {
    updateProfile({
      babyName: name.trim() || null,
      nickname: nickname.trim() || null,
      babyDob: dob ? new Date(dob).toISOString() : null,
      babyGender: gender,
      bloodType,
      allergies,
      pediatrician,
      medicalNotes,
      parentNotes,
    });
    haptics.success();
    router.back();
  }

  function addContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    baby.addEmergencyContact({ name: contactName.trim(), relation: contactRelation.trim(), phone: contactPhone.trim() });
    setContactName("");
    setContactRelation("");
    setContactPhone("");
    haptics.success();
  }

  function resetDemoData() {
    Alert.alert(t("baby_settings_reset"), t("baby_settings_reset_confirm"), [
      { text: t("cancel_action"), style: "cancel" },
      { text: t("delete_action"), style: "destructive", onPress: () => { resetBabyData(); router.back(); } },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("baby_settings_title")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable onPress={pickPhoto} className="mb-6 items-center gap-2 pt-2">
          {profile.babyPhoto ? (
            <Image source={{ uri: profile.babyPhoto }} className="h-24 w-24 rounded-full" />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-cream-soft">
              <Icon name="baby" size={32} color="#A79D8A" />
            </View>
          )}
          <Text className="font-bodyMedium text-[13px] text-orange">{t("baby_settings_photo")}</Text>
        </Pressable>

        <Text className="mb-2 font-display text-base text-ink">{t("baby_settings_edit_profile")}</Text>
        <View style={shadows.soft} className="gap-4 rounded-xl3 border border-ink/10 bg-white p-5">
          <Field label={t("baby_settings_name")}>
            <TextInput value={name} onChangeText={setName} className="font-body text-[15px] text-ink" />
          </Field>
          <Field label={t("baby_settings_nickname")}>
            <TextInput value={nickname} onChangeText={setNickname} className="font-body text-[15px] text-ink" />
          </Field>
          <Field label={t("baby_settings_dob")}>
            <TextInput value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor="#A79D8A" className="font-body text-[15px] text-ink" />
          </Field>
          <View className="gap-1.5">
            <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("baby_settings_gender")}</Text>
            <View className="flex-row gap-2">
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  className={`flex-1 items-center rounded-xl border py-2.5 ${gender === g ? "border-ink bg-ink" : "border-ink/10 bg-white"}`}
                >
                  <Text className={`font-bodyMedium text-[12px] ${gender === g ? "text-cream" : "text-ink"}`}>{t(`gender_${g}` as never)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Text className="mb-2 mt-6 font-display text-base text-ink">{t("baby_medical_info")}</Text>
        <View style={shadows.soft} className="gap-4 rounded-xl3 border border-ink/10 bg-white p-5">
          <View className="gap-1.5">
            <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("baby_settings_blood_type")}</Text>
            <View className="flex-row flex-wrap gap-2">
              {BLOOD_TYPES.map((bt) => (
                <Pressable
                  key={bt}
                  onPress={() => setBloodType(bt)}
                  className={`rounded-xl border px-3.5 py-2 ${bloodType === bt ? "border-ink bg-ink" : "border-ink/10 bg-white"}`}
                >
                  <Text className={`font-bodyMedium text-[12.5px] ${bloodType === bt ? "text-cream" : "text-ink"}`}>{bt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label={t("baby_settings_allergies")}>
            <TextInput value={allergies} onChangeText={setAllergies} className="font-body text-[15px] text-ink" />
          </Field>
          <Field label={t("baby_settings_pediatrician")}>
            <TextInput value={pediatrician} onChangeText={setPediatrician} className="font-body text-[15px] text-ink" />
          </Field>
          <Field label={t("baby_settings_medical_notes")}>
            <TextInput value={medicalNotes} onChangeText={setMedicalNotes} multiline className="font-body text-[15px] text-ink" />
          </Field>
          <Field label={t("baby_settings_parent_notes")}>
            <TextInput value={parentNotes} onChangeText={setParentNotes} multiline className="font-body text-[15px] text-ink" />
          </Field>
        </View>

        <Pressable onPress={save} className="mt-5 items-center rounded-2xl bg-ink py-4">
          <Text className="font-bodySemibold text-[15px] text-cream">{t("save_action")}</Text>
        </Pressable>

        <Text className="mb-2 mt-8 font-display text-base text-ink">{t("baby_settings_emergency_contacts")}</Text>
        <View style={shadows.soft} className="rounded-xl3 border border-ink/10 bg-white p-5">
          {state.baby.emergencyContacts.map((c) => (
            <View key={c.id} className="flex-row items-center justify-between border-b border-ink/8 py-3">
              <View>
                <Text className="font-bodySemibold text-[13.5px] text-ink">{c.name}</Text>
                <Text className="font-body text-xs text-ink-soft">
                  {c.relation} {c.relation ? "· " : ""}{c.phone}
                </Text>
              </View>
              <Pressable onPress={() => baby.removeEmergencyContact(c.id)} hitSlop={8}>
                <Icon name="close" size={16} color="#A79D8A" />
              </Pressable>
            </View>
          ))}
          <View className="gap-2.5 pt-3">
            <FormField label={t("emergency_contact_name_ph")} value={contactName} onChangeText={setContactName} />
            <FormField label={t("emergency_contact_relation_ph")} value={contactRelation} onChangeText={setContactRelation} />
            <FormField label={t("emergency_contact_phone_ph")} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
            <Pressable onPress={addContact} className="mt-1 items-center rounded-2xl bg-cream-soft py-3">
              <Text className="font-bodySemibold text-[13.5px] text-ink">{t("emergency_contact_add")}</Text>
            </Pressable>
          </View>
        </View>

        <Text className="mb-2 mt-8 font-display text-base text-ink">{t("export_title")}</Text>
        <View style={shadows.soft} className="overflow-hidden rounded-xl3 border border-ink/10 bg-white">
          <Pressable
            onPress={() => router.push("/(main)/baby/archive")}
            className="flex-row items-center gap-3 border-b border-ink/8 px-5 py-4"
          >
            <Icon name="download" size={17} color="#2C271F" />
            <Text className="flex-1 font-bodyMedium text-[14px] text-ink">{t("archived_records_title")}</Text>
            <Icon name="chevronRight" size={15} color="#A79D8A" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(main)/baby/audit-log")}
            className="flex-row items-center gap-3 border-b border-ink/8 px-5 py-4"
          >
            <Icon name="edit" size={17} color="#2C271F" />
            <Text className="flex-1 font-bodyMedium text-[14px] text-ink">{t("audit_log_title")}</Text>
            <Icon name="chevronRight" size={15} color="#A79D8A" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(main)/baby/export")}
            className="flex-row items-center gap-3 px-5 py-4"
          >
            <Icon name="share" size={17} color="#2C271F" />
            <Text className="flex-1 font-bodyMedium text-[14px] text-ink">{t("export_title")}</Text>
            <Icon name="chevronRight" size={15} color="#A79D8A" />
          </Pressable>
        </View>

        <Text className="mb-2 mt-8 font-display text-base text-ink">{t("baby_settings_danger")}</Text>
        <Pressable onPress={resetDemoData} className="items-center rounded-2xl border border-red-200 bg-red-50 py-4">
          <Text className="font-bodySemibold text-[14px] text-red-500">{t("baby_settings_reset")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5 border-b border-ink/8 pb-3">
      <Text className="font-bodyMedium text-[13px] text-ink-soft">{label}</Text>
      {children}
    </View>
  );
}
