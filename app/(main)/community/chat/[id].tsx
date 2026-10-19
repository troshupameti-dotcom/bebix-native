import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, Platform, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { ArrowUp, Camera, Ellipsis } from "lucide-react-native";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { Avatar } from "@/components/community/PostCard";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useKeyboardInset } from "@/lib/ui/keyboard";
import { formatTime, formatDate } from "@/lib/dateUtils";
import { logWarn } from "@/lib/log";
import { blockUser, getCurrentUserId } from "@/lib/communityData";
import {
  dayKey, deleteMessage, fetchConversation, fetchMessages, markConversationRead, MESSAGE_MAX, messageErrorKey, noteScreenshot,
  PAGE_SIZE, sendMessage, subscribeToConversation, type Message,
} from "@/lib/community/messages";

/** Mesazhet e të njëjtit person brenda kaq minutash bashkohen në një grup (ora del vetëm te i fundit). */
const GROUP_MINUTES = 5;

function sameGroup(a: Message | undefined, b: Message | undefined): boolean {
  return (
    !!a && !!b && a.kind === "text" && b.kind === "text" && a.senderId === b.senderId && dayKey(a.at) === dayKey(b.at) &&
    Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime()) <= GROUP_MINUTES * 60_000
  );
}

/**
 * Biseda: mesazhet (më të rejat poshtë), dërgimi, fshirja e mesazhit tim (shtyp gjatë), bllokimi. Mesazhet e reja
 * vijnë menjëherë. Mesazhet e njëpasnjëshme të të njëjtit person grupohen, me orën vetëm te i fundit.
 * Screenshot-i: në Android ndalohet (ekrani del i zi); në iPhone, ku Apple s'e lejon ndalimin, biseda merr shënimin
 * "bëri një screenshot".
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

  // Tastiera: hapësira poshtë = sa e mbulon tastiera ekranin e bisedës (pa shiritin e tab-eve, kur është aty).
  const { ref: keyboardRef, inset: keyboardInset, onLayout: onKeyboardLayout } = useKeyboardInset();

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
                  goBackOr("/(main)/community/inbox");
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

  function dayLabel(iso: string): string {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (dayKey(iso) === dayKey(now.toISOString())) return t("diary_today");
    if (dayKey(iso) === dayKey(yesterday.toISOString())) return t("diary_yesterday");
    return formatDate(iso, lang);
  }

  // Lista është përmbys: index + 1 = mesazhi më i vjetër (sipër), index − 1 = më i riu (poshtë).
  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const showDay = !older || dayKey(older.at) !== dayKey(item.at);
    const mine = item.senderId === me;
    const joinsAbove = !showDay && sameGroup(older, item);
    const joinsBelow = sameGroup(item, newer) && dayKey(newer?.at ?? "") === dayKey(item.at);

    // Qoshja ngjitur me grupin bëhet e vogël, që mesazhet e një grupi të duken bashkë.
    const big = 20;
    const small = 6;
    const corners = mine
      ? { borderTopRightRadius: joinsAbove ? small : big, borderBottomRightRadius: joinsBelow ? small : big, borderTopLeftRadius: big, borderBottomLeftRadius: big }
      : { borderTopLeftRadius: joinsAbove ? small : big, borderBottomLeftRadius: joinsBelow ? small : big, borderTopRightRadius: big, borderBottomRightRadius: big };

    return (
      <View>
        {showDay ? (
          <View className="my-4 items-center">
            <View className="rounded-full bg-cream-soft px-3 py-1">
              <Text className="font-bodyMedium text-[11.5px] text-ink-soft">{dayLabel(item.at)}</Text>
            </View>
          </View>
        ) : null}
        {item.kind === "screenshot" ? (
          <View className="my-2 flex-row items-center justify-center">
            <Camera size={12} color={theme.inkFaint} strokeWidth={2} />
            <Text className="ml-1.5 font-body text-[11.5px] text-ink-faint">
              {mine ? t("dm_screenshot_me") : t("dm_screenshot_other", { name: other?.otherName ?? "" })}
            </Text>
          </View>
        ) : (
          <Pressable
            onLongPress={() => messageMenu(item)}
            delayLongPress={350}
            accessibilityLabel={`${item.body}, ${formatTime(item.at, lang)}`}
            className={`max-w-[78%] ${mine ? "self-end" : "self-start"} ${joinsAbove ? "mt-0.5" : "mt-2"}`}
          >
            <View
              style={corners}
              className={`px-3.5 py-2 ${mine ? "bg-olive" : "border border-cream-line bg-surface"}`}
            >
              <Text className={`font-body text-[15px] leading-[21px] ${mine ? "text-on-accent" : "text-ink"}`}>{item.body}</Text>
            </View>
            {!joinsBelow ? (
              <Text className={`mt-1 font-body text-[10.5px] text-ink-faint ${mine ? "text-right" : "text-left"} px-1`}>
                {formatTime(item.at, lang)}
              </Text>
            ) : null}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Koka: foto dhe emri (hapin profilin), menuja. */}
      <View className="flex-row items-center border-b border-cream-line px-4 pb-2.5 pt-1.5">
        <BackButton fallback="/community/inbox" className="mr-1" />
        <Pressable
          onPress={() => other && router.push(`/community/user/${other.otherId}`)}
          disabled={!other}
          className="flex-1 flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={other ? `${other.otherName}, ${t("dm_view_profile")}` : undefined}
        >
          {other ? <Avatar initial={other.otherName.trim().charAt(0).toUpperCase() || "?"} accent="olive" size={38} userId={other.otherId} /> : null}
          <Text className="ml-2.5 flex-1 font-bodySemibold text-[16px] text-ink" numberOfLines={1}>
            {other?.otherName ?? ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={chatMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("dm_options")}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Ellipsis size={20} color={theme.ink} strokeWidth={2.2} />
        </Pressable>
      </View>

      {other === undefined ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}
      {other === null ? <Text className="mt-10 text-center font-body text-sm text-ink-soft">{t("dm_missing")}</Text> : null}

      {other ? (
        <View ref={keyboardRef} className="flex-1" style={{ paddingBottom: keyboardInset }} onLayout={onKeyboardLayout}>
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.3}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}
            ListEmptyComponent={
              <View className="my-10 items-center px-8" style={{ transform: [{ scaleY: -1 }] }}>
                <Avatar initial={other.otherName.trim().charAt(0).toUpperCase() || "?"} accent="olive" size={64} userId={other.otherId} />
                <Text className="mt-3 font-bodySemibold text-[16px] text-ink">{other.otherName}</Text>
                <Text className="mt-1 text-center font-body text-[13px] text-ink-soft">{t("dm_say_hi")}</Text>
              </View>
            }
          />

          {other.canSend ? (
            <View className="flex-row items-end px-3 pb-3 pt-1.5">
              <View className="mr-2 min-h-[44px] flex-1 justify-center rounded-[22px] border border-cream-line bg-surface px-4">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("dm_placeholder")}
                  placeholderTextColor={theme.inkFaint}
                  multiline
                  maxLength={MESSAGE_MAX}
                  accessibilityLabel={t("dm_placeholder")}
                  className="max-h-32 py-2.5 font-body text-[15px] text-ink"
                />
              </View>
              <Pressable
                onPress={() => void send()}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t("dm_send")}
                accessibilityState={{ disabled: !canSend }}
                className={`h-11 w-11 items-center justify-center rounded-full ${canSend ? "bg-olive" : "bg-cream-soft"}`}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.onAccent} />
                ) : (
                  <ArrowUp size={20} color={canSend ? theme.onAccent : theme.inkFaint} strokeWidth={2.6} />
                )}
              </Pressable>
            </View>
          ) : (
            <Text className="border-t border-cream-line px-6 py-4 text-center font-body text-xs leading-5 text-ink-faint">{t("dm_cannot_send")}</Text>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
