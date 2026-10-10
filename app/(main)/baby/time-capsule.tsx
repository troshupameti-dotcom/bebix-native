import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { supabase } from "@/lib/supabase/client";
import {
  daysUntil, defaultUnlockDate, deleteLetter, isUnlocked, isValidUnlockDate, listLetters, openLetter, sealLetter, toDateKey,
  type CapsuleLetter,
} from "@/lib/baby/timeCapsule";

const MAX_BODY = 20000;

/**
 * Kapsula e kohës: letra për fëmijën që hapen në një datë (parazgjedhja:
 * ditëlindja e 18-të). Pasi vuloset, letra s'lexohet as nga ai që e shkroi
 * — e mban serveri, jo vetëm ky ekran.
 */
export default function TimeCapsuleScreen() {
  const { t, lang } = useTranslation();
  const { state } = useAppState();
  const { showToast } = useToast();
  const babyName = state.profile.nickname || state.profile.babyName || t("your_baby");

  const [letters, setLetters] = useState<CapsuleLetter[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [unlockOn, setUnlockOn] = useState(() => defaultUnlockDate(state.profile.babyDob));
  const [sealing, setSealing] = useState(false);

  const [reading, setReading] = useState<{ letter: CapsuleLetter; text: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      setLetters(await listLetters());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listLetters()
      .then((list) => alive && setLetters(list))
      .catch(() => alive && setFailed(true));
    supabase.auth
      .getUser()
      .then(({ data }) => alive && setMe(data.user?.id ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "long", year: "numeric" });
  };

  function startCompose() {
    haptics.tap();
    setTitle(t("capsule_default_title", { name: babyName }));
    setBody("");
    setUnlockOn(defaultUnlockDate(state.profile.babyDob));
    setComposeOpen(true);
  }

  function confirmSeal() {
    if (!title.trim() || !body.trim()) {
      showToast(t("capsule_fill"));
      return;
    }
    if (!isValidUnlockDate(unlockOn)) {
      showToast(t("capsule_bad_date"));
      return;
    }
    Alert.alert(t("capsule_seal_confirm_title"), t("capsule_seal_confirm_body", { date: fmt(unlockOn) }), [
      { text: t("cancel_action"), style: "cancel" },
      { text: t("capsule_seal"), onPress: () => void seal() },
    ]);
  }

  async function seal() {
    setSealing(true);
    try {
      await sealLetter(title, body, unlockOn);
      haptics.success();
      setComposeOpen(false);
      showToast(t("capsule_sealed"));
      await load();
    } catch {
      showToast(t("capsule_error"));
    } finally {
      setSealing(false);
    }
  }

  async function open(letter: CapsuleLetter) {
    if (!isUnlocked(letter.unlockOn)) {
      haptics.select();
      showToast(t("capsule_locked_toast", { date: fmt(letter.unlockOn) }));
      return;
    }
    haptics.success();
    setReading({ letter, text: null });
    try {
      const text = await openLetter(letter.id);
      setReading({ letter, text: text ?? "" });
    } catch {
      setReading(null);
      showToast(t("capsule_error"));
    }
  }

  function remove(letter: CapsuleLetter) {
    Alert.alert(t("capsule_delete_title"), t("capsule_delete_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("delete_action"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLetter(letter.id);
            setLetters((l) => l?.filter((x) => x.id !== letter.id) ?? null);
          } catch {
            showToast(t("capsule_error"));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("capsule_title")}</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={[shadows.soft, { backgroundColor: TONES.amber.tintBg }]} className="rounded-xl3 p-5">
          <Text style={{ fontSize: 36 }}>💌</Text>
          <Text className="mt-2 font-display text-[22px] leading-7" style={{ color: "#17212B" }}>
            {t("capsule_hero", { name: babyName })}
          </Text>
          <Text className="mt-2 font-body text-[14px] leading-5" style={{ color: "#3B4652" }}>
            {t("capsule_hero_body")}
          </Text>
          <Pressable onPress={startCompose} accessibilityRole="button" className="mt-4 items-center rounded-2xl py-4" style={{ backgroundColor: "#17212B", minHeight: 56 }}>
            <Text className="font-bodySemibold text-[15px]" style={{ color: "#FFF8EF" }}>
              {t("capsule_write")}
            </Text>
          </Pressable>
        </View>

        {letters === null && !failed ? <ActivityIndicator className="mt-10" /> : null}
        {failed ? (
          <Pressable onPress={() => void load()} className="mt-8 items-center">
            <Text className="font-body text-sm text-ink-soft">{t("capsule_offline")}</Text>
          </Pressable>
        ) : null}
        {letters && letters.length === 0 ? <Text className="mt-8 text-center font-body text-sm text-ink-soft">{t("capsule_empty")}</Text> : null}

        {letters?.map((letter, i) => {
          const unlocked = isUnlocked(letter.unlockOn);
          const days = daysUntil(letter.unlockOn);
          return (
            <MotiView key={letter.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 220, delay: Math.min(i, 6) * 30 }}>
              <Pressable
                onPress={() => void open(letter)}
                onLongPress={letter.authorId === me ? () => remove(letter) : undefined}
                accessibilityRole="button"
                style={shadows.soft}
                className="mt-3 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: unlocked ? TONES.green.tintBg : TONES.amber.tintBg }}>
                  <Icon name={unlocked ? "heart" : "lock"} size={18} color={unlocked ? TONES.green.tint : TONES.amber.tint} />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
                    {letter.title}
                  </Text>
                  <Text className="font-body text-xs text-ink-soft">
                    {unlocked ? t("capsule_ready") : t("capsule_opens", { date: fmt(letter.unlockOn), n: days })}
                  </Text>
                </View>
                {letter.authorId === me ? (
                  <Pressable onPress={() => remove(letter)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("delete_action")}>
                    <Icon name="trash" size={16} color="#8A929A" />
                  </Pressable>
                ) : null}
              </Pressable>
            </MotiView>
          );
        })}
      </ScrollView>

      <BottomSheet visible={composeOpen} onClose={() => !sealing && setComposeOpen(false)} maxHeightPct={90}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
          <Text className="font-display text-xl text-ink">{t("capsule_write")}</Text>
          <FormField label={t("capsule_letter_title")} value={title} onChangeText={setTitle} maxLength={120} />
          <FormField
            label={t("capsule_letter_body")}
            placeholder={t("capsule_letter_ph", { name: babyName })}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_BODY}
            style={{ minHeight: 180, textAlignVertical: "top" }}
          />
          <DateTimeField
            label={t("capsule_unlock_on")}
            mode="date"
            value={new Date(`${unlockOn}T12:00:00`).toISOString()}
            onChange={(iso) => setUnlockOn(toDateKey(new Date(iso)))}
          />
          <Text className="font-body text-xs text-ink-soft">{t("capsule_seal_hint")}</Text>
          <Pressable onPress={confirmSeal} disabled={sealing} className="items-center rounded-2xl bg-ink py-4" style={{ minHeight: 56 }}>
            {sealing ? <ActivityIndicator color="#FBF6EE" /> : <Text className="font-bodyMedium text-[15px] text-cream">{t("capsule_seal")} 💌</Text>}
          </Pressable>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={!!reading} onClose={() => setReading(null)} maxHeightPct={90}>
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
          <Text className="mb-3 font-display text-xl text-ink">{reading?.letter.title ?? ""}</Text>
          {reading?.text == null ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-body text-[15.5px] leading-6 text-ink">{reading.text}</Text>
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
