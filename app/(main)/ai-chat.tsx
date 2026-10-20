import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { KeyboardSafeView } from "@/lib/ui/keyboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { askAi, type AiFailure } from "@/lib/ai/chat";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { useAppState } from "@/lib/state/AppStateContext";
import { computeAgeText } from "@/lib/dateUtils";
import type { TranslationKey } from "@/lib/i18n/translations";

const FAILURE_KEY: Record<AiFailure, TranslationKey> = {
  auth: "ai_chat_err_auth",
  not_ready: "ai_chat_not_ready",
  limit: "ai_chat_limit",
  busy: "ai_chat_busy",
  refusal: "ai_chat_refusal",
  offline: "ai_chat_offline",
};

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Mesazh nga app-i (përshëndetja, gabimet), jo përgjigje e AI-së: s'i dërgohet AI-së në pyetjen tjetër. */
  notice?: boolean;
};

export default function AiChatScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { t, lang } = useTranslation();
  const { state } = useAppState();
  const active = useActiveChild();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "ai", text: t("ai_chat_welcome"), notice: true },
  ]);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    scrollToEnd();

    // AI-ja merr vetëm fazën dhe moshën e fëmijës (pa emër), që përgjigjja t'i përshtatet.
    const dob = state.profile.babyDob;
    const result = await askAi(
      next.filter((m) => !m.notice).map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })),
      lang,
      { stage: active.stage ?? undefined, age: dob ? computeAgeText(dob, lang) : undefined }
    );
    const reply: ChatMessage = result.ok
      ? { id: `a-${Date.now()}`, role: "ai", text: result.text }
      : { id: `n-${Date.now()}`, role: "ai", text: t(FAILURE_KEY[result.reason], { n: result.limit ?? 30 }), notice: true };
    setMessages((prev) => [...prev, reply]);
    setSending(false);
    scrollToEnd();
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <BackButton fallback="/(main)/baby" className="mr-3" />
        <View className="flex-1">
          <Text className="font-bodySemibold text-lg text-ink">{t("ai_chat_title")}</Text>
          <Text className="font-body text-xs text-ink-soft">{t("ai_chat_subtitle")}</Text>
        </View>
        <View className="w-10 h-10 rounded-full bg-olive-bg items-center justify-center">
          <Icon name="sparkle" size={18} color="#6E7452" />
        </View>
      </View>

      <KeyboardSafeView>
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
                    m.role === "user" ? "text-on-accent" : "text-ink"
                  }`}
                >
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
          {sending ? (
            <View className="mb-3 flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-olive-bg items-center justify-center mr-2">
                <Icon name="sparkle" size={14} color="#6E7452" />
              </View>
              <View style={shadows.soft} className="flex-row items-center rounded-xl2 bg-surface px-3 py-2.5">
                <ActivityIndicator size="small" className="text-ink-faint" />
                <Text className="ml-2 font-body text-xs text-ink-soft">{t("ai_chat_typing")}</Text>
              </View>
            </View>
          ) : null}
          <Text className="mt-2 text-center font-body text-[11px] leading-4 text-ink-faint">{t("ai_chat_disclaimer")}</Text>
        </ScrollView>

        {/* Input bar */}
        <View className="flex-row items-center px-5 py-3 border-t border-cream-soft">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("ai_chat_input_ph")}
            placeholderClassName="text-ink-faint"
            className="flex-1 bg-surface rounded-full px-4 py-3 mr-3 font-body text-sm text-ink"
            style={shadows.soft}
            multiline
            onSubmitEditing={() => void handleSend()}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!input.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={t("ai_chat_send")}
            accessibilityState={{ disabled: !input.trim() || sending }}
            style={shadows.soft}
            className={`w-11 h-11 rounded-full items-center justify-center ${
              input.trim() && !sending ? "bg-orange" : "bg-surface"
            }`}
          >
            <Icon name="send" size={18} color={input.trim() && !sending ? "#FFFFFF" : "#A79D8A"} />
          </Pressable>
        </View>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}