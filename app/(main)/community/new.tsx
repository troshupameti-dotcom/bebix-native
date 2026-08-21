import { useState } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

/**
 * Kompozuesi i postimit të ri. Për tani UI-ja punon plotësisht, por
 * "Posto" s'e ruan ende postimin diku — kjo kërkon një tabelë `posts` në
 * Supabase (që edhe përdorues të tjerë ta shohin). Deri atëherë, shtypja
 * e butonit thjesht konfirmon dhe kthehet mbrapa.
 */
export default function NewPostScreen() {
  const router = useRouter();
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    Alert.alert(
      "Postimi u përgatit",
      "Ruajtja reale e postimeve (që t'i shohin edhe prindër të tjerë) do të aktivizohet kur të lidhet Community me Supabase.",
      [{ text: "Kuptova", onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()}>
          <Icon name="close" size={22} color="#2C271F" />
        </Pressable>
        <Text className="font-bodySemibold text-lg text-ink">Postim i Ri</Text>
        <Pressable onPress={submit} disabled={!text.trim()} className={`px-4 py-2 rounded-full ${text.trim() ? "bg-olive" : "bg-cream-line"}`}>
          <Text className={`font-bodyMedium text-xs ${text.trim() ? "text-white" : "text-ink-faint"}`}>Posto</Text>
        </Pressable>
      </View>

      <View className="px-5">
        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Çfarë ke ndër mend, prind?"
            placeholderTextColor="#A79D8A"
            multiline
            className="font-body text-sm text-ink min-h-[120px]"
            textAlignVertical="top"
          />
        </View>

        <View className="flex-row mt-4">
          <Pressable style={shadows.soft} className="flex-1 bg-surface rounded-xl2 p-3 items-center mr-2">
            <Icon name="camera" size={18} color="#6E7452" />
            <Text className="font-bodyMedium text-[11px] text-ink-soft mt-1">Foto</Text>
          </Pressable>
          <Pressable style={shadows.soft} className="flex-1 bg-surface rounded-xl2 p-3 items-center mr-2">
            <Icon name="play" size={18} color="#6E7452" />
            <Text className="font-bodyMedium text-[11px] text-ink-soft mt-1">Video</Text>
          </Pressable>
          <Pressable style={shadows.soft} className="flex-1 bg-surface rounded-xl2 p-3 items-center">
            <Icon name="chart" size={18} color="#6E7452" />
            <Text className="font-bodyMedium text-[11px] text-ink-soft mt-1">Sondazh</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}