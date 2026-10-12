import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { formatTime, formatDate } from "@/lib/dateUtils";
import { logWarn } from "@/lib/log";
import { blockUser, getCurrentUserId } from "@/lib/communityData";
import {
  dayKey, deleteMessage, fetchConversation, fetchMessages, markConversationRead, MESSAGE_MAX, messageErrorKey, noteScreenshot,
  PAGE_SIZE, sendMessage, subscribeToConversation, type Message,
} from "@/lib/community/messages";

/**
 * Biseda: mesazhet (më të rejat poshtë), dërgimi, fshirja e mesazhit tim
 * (shtyp gjatë), bllokimi. Mesazhet e reja vijnë menjëherë.
 * Screenshot-i: në Android ndalohet (ekrani del i zi); në iPhone, ku Apple s'e
 * lejon ndalimin, biseda merr shënimin "bëri një screenshot".
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useTranslation();
  const theme = useThemeColors();
  const [me, setMe] = useState<string | null>(null);
  const [other, setOther] = useState<{ otherId: string; otherName: string; canSend: boolean } | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);

  ScreenCapture.usePreventScreenCapture(`dm-${id}`);

  // iPhone: shënim te biseda kur bëhet screenshot.
  useEffect(() => {
    if (Platform.OS !== "ios" || !id) return;
    const sub = ScreenCapture.addScreenshotListener(() => void noteScreenshot(id));
    return () => sub.remove();
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [uid, conv, list] = await Promise.all([getCurrentUserId(), fetchConversation(id), fetchMessages(id)]);
      setMe(uid);
      setOther(conv);
      setMessages(list);
      setHasMore(list.length >= PAGE_SIZE);
      void markConversationRead(id);
    } catch (err) {
      logWarn("Chat load error:", err);
      setOther((prev) => prev ?? null);
    }
  }, [id]);

  // Hapja (dhe kthimi te biseda): mesazhet dhe "e lexuar".
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Të rejat menjëherë; të lexuara sa kohë biseda është e hapur.
  useEffect(() => {
    if (!id) return;
    return subscribeToConversation(
      id,
      (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
        void markConversationRead(id);
      },
      (deletedId) => setMessages((prev) => prev.filter((x) => x.id !== deletedId))
    );
  }, [id]);

  async function loadOlder() {
    if (!id || !hasMore || loadingMore.current || messages.length === 0) return;
    loadingMore.current = true;
    try {
      const older = await fetchMessages(id, messages[messages.length - 1].at);
      setMessages((prev) => [...prev, ...older.filter((o) => !prev.some((p) => p.id === o.id))]);
      setHasMore(older.length >= PAGE_SIZE);
    } catch (err) {
      logWarn("Chat older error:", err);
    } finally {
      loadingMore.current = false;
    }
  }

  const canSend = !!other?.canSend && draft.trim().length > 0 && !sending;

  async function send() {
    if (!id || !canSend) return;
    setSending(true);
    try {
      const m = await sendMessage(id, draft);
      haptics.tap();
      setDraft("");
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(messageErrorKey(err)));
    } finally {
      setSending(false);
    }
  }

  function messageMenu(m: Message) {
    if (m.senderId !== me || m.kind !== "text") return;
    haptics.select();
    Alert.alert(t("dm_delete_title"), t("dm_delete_body"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("dm_delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMessage(m.id);
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
          } catch (err) {
            Alert.alert(t("mod_error_title"), t(messageErrorKey(err)));
          }
        },
      },
    ]);
  }

  function chatMenu() {
    if (!other) return;
    haptics.tap();
    Alert.alert(other.otherName, undefined, [
      { text: t("dm_view_profile"), onPress: () => router.push(`/community/user/${other.otherId}`) },
      {
        text: t("dm_block"),
        style: "destructive",
        onPress: () =>
          Alert.alert(t("dm_block_title", { name: other.otherName }), t("dm_block_body"), [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("dm_block"),
              style: "destructive",
              onPress: async () => {
                try {
                  await blockUser(other.otherId);
                  router.back();
                } catch (err) {
                  Alert.alert(t("mod_error_title"), t(messageErrorKey(err)));
                }
              },
            },
          ]),
      },
      { text: t("cancel"), style: "cancel" },
    ]);
  }

  // Ndarësi i ditës shfaqet sipër mesazhit të parë të çdo dite (lista është përmbys).
  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const older = messages[index + 1];
    const showDay = !older || dayKey(older.at) !== dayKey(item.at);
    const mine = item.senderId === me;
    return (
      <View>
        {showDay ? <Text className="my-3 text-center font-bodyMedium text-[11px] text-ink-faint">{formatDate(item.at, lang)}</Text> : null}
        {item.kind === "screenshot" ? (
          <Text className="my-1.5 text-center font-body text-[11px] text-ink-faint">
            {mine ? t("dm_screenshot_me") : t("dm_screenshot_other", { name: other?.otherName ?? "" })}
          </Text>
        ) : (
          <Pressable onLongPress={() => messageMenu(item)} delayLongPress={350} className={`my-1 max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
            <View style={mine ? undefined : shadows.soft} className={`rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md bg-olive" : "rounded-bl-md bg-surface"}`}>
              <Text className={`font-body text-[14px] leading-5 ${mine ? "text-on-accent" : "text-ink"}`}>{item.body}</Text>
            </View>
            <Text className={`mt-0.5 font-body text-[10px] text-ink-faint ${mine ? "text-right" : "text-left"}`}>{formatTime(item.at, lang)}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center border-b border-cream-line px-5 pb-2 pt-2">
        <BackButton fallback="/community/inbox" className="mr-3" />
        <Pressable onPress={() => other && router.push(`/community/user/${other.otherId}`)} className="flex-1" accessibilityRole="button">
          <Text className="font-display text-lg text-ink" numberOfLines={1}>{other?.otherName ?? ""}</Text>
        </Pressable>
        <Pressable onPress={chatMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("dm_options")} className="h-10 w-10 items-center justify-center">
          <Text className="font-bodySemibold text-lg leading-5 text-ink-faint">⋯</Text>
        </Pressable>
      </View>

      {other === undefined ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}
      {other === null ? <Text className="mt-10 text-center font-body text-sm text-ink-soft">{t("dm_missing")}</Text> : null}

      {other ? (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={60}>
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
            ListEmptyComponent={<Text className="my-6 text-center font-body text-xs text-ink-faint" style={{ transform: [{ scaleY: -1 }] }}>{t("dm_say_hi")}</Text>}
          />

          {other.canSend ? (
            <View className="border-t border-cream-line bg-cream px-4 pb-3 pt-2">
              <View style={shadows.soft} className="flex-row items-end rounded-xl2 bg-surface px-3 py-2">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("dm_placeholder")}
                  placeholderTextColor={theme.inkFaint}
                  multiline
                  maxLength={MESSAGE_MAX}
                  className="max-h-28 flex-1 py-1.5 font-body text-sm text-ink"
                />
                <Pressable
                  onPress={() => void send()}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel={t("dm_send")}
                  className={`ml-2 h-10 w-10 items-center justify-center rounded-full ${canSend ? "bg-olive" : "bg-cream-line"}`}
                >
                  {sending ? <ActivityIndicator size="small" color={theme.onAccent} /> : <Icon name="send" size={16} color={canSend ? theme.onAccent : theme.inkFaint} />}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text className="border-t border-cream-line px-6 py-4 text-center font-body text-xs leading-5 text-ink-faint">{t("dm_cannot_send")}</Text>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}
