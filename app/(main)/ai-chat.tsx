import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

// ⚠️ Kjo është përgjigje placeholder — s'është lidhje reale me AI ende.
// Kur të vendoset backend real, kjo funksion zëvendësohet me thirrje API.
function getPlaceholderReply(question: string): string {
  return "Faleminderit për pyetjen! Lidhja e vërtetë me AI ende s'është aktivizuar — kjo është vetëm një përgjigje shembull për tani.";
}

export default function AiChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Përshëndetje! Më pyet çdo gjë rreth bebit tënd — ushqyerje, gjumë, zhvillim, apo çfarëdo shqetësimi.",
    },
  ]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const aiMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "ai",
      text: getPlaceholderReply(trimmed),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <Pressable
          onPress={() => router.back()}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <View className="flex-1">
          <Text className="font-bodySemibold text-lg text-ink">Asistenti AI</Text>
          <Text className="font-body text-xs text-ink-soft">Gjithmonë gati me ndihmë</Text>
        </View>
        <View className="w-10 h-10 rounded-full bg-olive-bg items-center justify-center">
          <Icon name="sparkle" size={18} color="#6E7452" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              className={`mb-3 flex-row ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "ai" && (
                <View className="w-8 h-8 rounded-full bg-olive-bg items-center justify-center mr-2 mt-1">
                  <Icon name="sparkle" size={14} color="#6E7452" />
                </View>
              )}
              <View
                style={shadows.soft}
                className={`max-w-[75%] rounded-xl2 p-3 ${
                  m.role === "user" ? "bg-orange" : "bg-surface"
                }`}
              >
                <Text
                  className={`font-body text-sm leading-5 ${
                    m.role === "user" ? "text-white" : "text-ink"
                  }`}
                >
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View className="flex-row items-center px-5 py-3 border-t border-cream-soft">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Shkruaj një pyetje..."
            placeholderTextColor="#A79D8A"
            className="flex-1 bg-surface rounded-full px-4 py-3 mr-3 font-body text-sm text-ink"
            style={shadows.soft}
            multiline
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim()}
            style={shadows.soft}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              input.trim() ? "bg-orange" : "bg-surface"
            }`}
          >
            <Icon name="send" size={18} color={input.trim() ? "#FFFFFF" : "#A79D8A"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}