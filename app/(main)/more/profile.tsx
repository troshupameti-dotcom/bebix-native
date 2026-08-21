import { useState } from "react";
import { View, Text, Pressable, TextInput, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAppState } from "@/lib/state/AppStateContext";
import { ParentRelation } from "@/lib/state/types";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

const RELATIONS: { value: ParentRelation; label: string }[] = [
  { value: "mom", label: "Mama" },
  { value: "dad", label: "Babi" },
  { value: "guardian", label: "Kujdestar/e" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { state, updateProfile } = useAppState();
  const [name, setName] = useState(state.profile.parentName || "");
  const [relation, setRelation] = useState<ParentRelation>(state.profile.relation);
  const [photo, setPhoto] = useState(state.profile.parentPhoto);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const save = () => {
    updateProfile({ parentName: name.trim() || null, relation, parentPhoto: photo });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-5">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-bodyMedium text-lg text-ink">Profili Im</Text>
        <Pressable onPress={save} className="px-4 py-2 rounded-full bg-olive">
          <Text className="font-bodySemibold text-xs text-white">Ruaj</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="items-center mb-6">
          <Pressable onPress={pickPhoto} className="w-24 h-24 rounded-full bg-olive-bg items-center justify-center overflow-hidden mb-2">
            {photo ? <Image source={{ uri: photo }} className="w-24 h-24" /> : <Icon name="camera" size={28} color="#6E7452" />}
          </Pressable>
          <Pressable onPress={pickPhoto}>
            <Text className="font-bodyMedium text-xs text-olive">Ndrysho foton</Text>
          </Pressable>
        </View>

        <View className="px-5">
          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Emri</Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-5">
            <TextInput value={name} onChangeText={setName} placeholder="Emri yt" placeholderTextColor="#A79D8A" className="font-body text-sm text-ink" />
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Marrëdhënia me bebin</Text>
          <View className="flex-row mb-5">
            {RELATIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRelation(r.value)}
                className={`px-4 py-2 rounded-full mr-2 ${relation === r.value ? "bg-olive" : "bg-surface"}`}
                style={relation !== r.value ? shadows.soft : undefined}
              >
                <Text className={`font-bodyMedium text-xs ${relation === r.value ? "text-white" : "text-ink-soft"}`}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={shadows.soft} className="bg-olive-bg rounded-xl2 p-4">
            <Text className="font-bodySemibold text-xs text-ink mb-1">Email dhe fjalëkalimi</Text>
            <Text className="font-body text-xs text-ink-soft leading-5">
              Këto menaxhohen nga llogaria jote Supabase (të njëjtat që përdor për kyçje) — do t'i shtojmë këtu si opsione editimi kur të lidhim ekranin me `supabase.auth.updateUser()`.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}