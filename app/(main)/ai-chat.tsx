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
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { shadows } from "@/lib/shadows";

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

export default function AiChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { state } = useAppState();
  const { t } = useTranslation();
  const isDark = state.darkMode;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "ai", text: t("ai_chat_welcome") },
  ]);

  // ⚠️ Kjo është përgjigje placeholder — s'është lidhje reale me AI ende.
  // Kur të vendoset backend real, kjo funksion zëvendësohet me thirrje API.
  function getPlaceholderReply(_question: string): string {
    return t("ai_chat_placeholder_reply");
  }

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
    <SafeAreaView className="flex-1 bg-cream dark:bg-ink" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <Pressable
          onPress={() => router.back()}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface dark:bg-ink/40 items-center justify-center mr-3"
        >
          <Icon name="chevronLeft" size={20} color={isDark ? "#F7F1E4" : "#2C271F"} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-bodySemibold text-lg text-ink dark:text-cream">{t("ai_chat_title")}</Text>
          <Text className="font-body text-xs text-ink-soft dark:text-cream/60">{t("ai_chat_subtitle")}</Text>
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
                  m.role === "user" ? "bg-orange" : "bg-surface dark:bg-ink/40"
                }`}
              >
                <Text
                  className={`font-body text-sm leading-5 ${
                    m.role === "user" ? "text-white" : "text-ink dark:text-cream"
                  }`}
                >
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View className="flex-row items-center px-5 py-3 border-t border-cream-soft dark:border-cream/10">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("ai_chat_input_ph")}
            placeholderTextColor="#A79D8A"
            className="flex-1 bg-surface dark:bg-ink/40 rounded-full px-4 py-3 mr-3 font-body text-sm text-ink dark:text-cream"
            style={shadows.soft}
            multiline
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim()}
            style={shadows.soft}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              input.trim() ? "bg-orange" : "bg-surface dark:bg-ink/40"
            }`}
          >
            <Icon name="send" size={18} color={input.trim() ? "#FFFFFF" : "#A79D8A"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}