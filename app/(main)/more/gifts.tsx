import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Image, Share, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ZoomScreen } from "@/components/ZoomScreen";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  createGiftList,
  fetchMyGiftList,
  releaseGiftReservation,
  removeGiftItem,
  setGiftQty,
  updateGiftList,
  type GiftListRow,
} from "@/lib/gifts/api";

const SITE = "https://www.bebix.store";

/** Lista e dhuratave: prindi e krijon, e ndan me familjen dhe sheh kush ka rezervuar çfarë. */
export default function GiftListScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [list, setList] = useState<GiftListRow | null | undefined>(undefined); // undefined = duke ngarkuar
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    fetchMyGiftList()
      .then((l) => {
        if (!active) return;
        setList(l);
        // Titulli dhe mesazhi mbushen vetëm herën e parë; ndryshimet e produkteve s'i fshijnë ato që po shkruan.
        setTitle((prev) => (prev === "" && l ? l.title : prev));
        setMessage((prev) => (prev === "" && l?.message ? l.message : prev));
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  async function run(action: () => Promise<void>, ok?: string) {
    setBusy(true);
    setNote("");
    try {
      await action();
      if (ok) setNote(ok);
      setReload((n) => n + 1);
    } catch {
      setNote(t("gift_error"));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View className="flex-row items-center px-5 pt-2 mb-4">
      <BackButton fallback="/(main)/more" className="mr-3" />
      <Text className="font-display text-2xl text-ink">{t("gift_title")}</Text>
    </View>
  );

  const inputClass = "bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4";

  let body: React.ReactNode;
  if (failed) {
    body = (
      <View className="items-center mt-16 px-8">
        <Text className="font-body text-sm text-ink-soft text-center mb-4">{t("gift_error")}</Text>
        <Pressable onPress={() => { setFailed(false); setReload((n) => n + 1); }} accessibilityRole="button" className="bg-olive rounded-xl2 py-3 px-6">
          <Text className="font-bodySemibold text-sm text-on-accent">{t("gift_retry")}</Text>
        </Pressable>
      </View>
    );
  } else if (list === undefined) {
    body = (
      <View className="mt-16">
        <ActivityIndicator className="text-olive" />
      </View>
    );
  } else if (list === null) {
    body = (
      <View className="px-5">
        <Text className="font-body text-sm text-ink-soft mb-5 leading-5">{t("gift_intro")}</Text>
        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("gift_title_label")}</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={80} placeholder={t("gift_title_ph")} placeholderClassName="text-ink-faint" style={shadows.soft} className={inputClass} />
        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("gift_message_label")}</Text>
        <TextInput value={message} onChangeText={setMessage} maxLength={500} multiline placeholder={t("gift_message_ph")} placeholderClassName="text-ink-faint" style={shadows.soft} className={`${inputClass} min-h-[84px]`} />
        {note ? <Text className="font-body text-xs text-ink-soft mb-3">{note}</Text> : null}
        <Pressable
          onPress={() => run(() => createGiftList(title.trim() || t("gift_title"), message.trim()))}
          disabled={busy}
          accessibilityRole="button"
          className="bg-olive rounded-xl2 py-3.5 items-center"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="font-bodySemibold text-[15px] text-on-accent">{t("gift_create")}</Text>
        </Pressable>
      </View>
    );
  } else {
    const url = `${SITE}/${language === "en" ? "en" : "sq"}/gifts/${list.slug}`;
    const items = list.gift_list_items ?? [];
    body = (
      <View className="px-5">
        <Text className="font-body text-sm text-ink-soft mb-4 leading-5">{t("gift_intro")}</Text>

        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-5">
          <Text className="font-bodySemibold text-sm text-ink mb-2">{t("gift_share")}</Text>
          <Text selectable className="font-body text-xs text-ink-soft mb-3" numberOfLines={2}>{url}</Text>
          <Pressable
            onPress={() => Share.share({ message: `${t("gift_share_msg")} ${url}` })}
            accessibilityRole="button"
            className="bg-olive rounded-xl2 py-3 items-center"
          >
            <Text className="font-bodySemibold text-sm text-on-accent">{t("gift_share_action")}</Text>
          </Pressable>
        </View>

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("gift_title_label")}</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={80} style={shadows.soft} className={inputClass} />
        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("gift_message_label")}</Text>
        <TextInput value={message} onChangeText={setMessage} maxLength={500} multiline style={shadows.soft} className={`${inputClass} min-h-[84px]`} />
        <Pressable
          onPress={() => run(() => updateGiftList(list.id, title.trim() || t("gift_title"), message.trim()), t("gift_saved"))}
          disabled={busy}
          accessibilityRole="button"
          className="bg-surface border border-olive rounded-xl2 py-3 items-center mb-2"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="font-bodyMedium text-sm text-olive">{t("gift_save")}</Text>
        </Pressable>
        {note ? <Text className="font-body text-xs text-ink-soft mb-2 text-center">{note}</Text> : null}

        <Text className="font-bodySemibold text-base text-ink mt-5 mb-3">{t("gift_items")}</Text>
        {items.length === 0 ? (
          <View style={shadows.soft} className="bg-surface rounded-xl2 p-5 items-center">
            <Text className="font-body text-sm text-ink-soft text-center mb-4 leading-5">{t("gift_empty")}</Text>
            <Pressable onPress={() => router.push("/(main)/shop")} accessibilityRole="button" className="bg-olive rounded-xl2 py-3 px-6">
              <Text className="font-bodySemibold text-sm text-on-accent">{t("gift_browse")}</Text>
            </Pressable>
          </View>
        ) : (
          items.map((item) => {
            const p = item.products;
            if (!p) return null;
            const reservations = item.gift_reservations ?? [];
            return (
              <View key={item.id} style={shadows.soft} className="bg-surface rounded-xl2 p-3 mb-3">
                <View className="flex-row items-center">
                  <View className="w-14 h-14 rounded-xl bg-olive-bg items-center justify-center mr-3 overflow-hidden">
                    {p.image_url ? <Image source={{ uri: p.image_url }} className="w-14 h-14" resizeMode="contain" /> : <Icon name="cube" size={20} color="#6E7452" />}
                  </View>
                  <Pressable onPress={() => router.push(`/shop/${p.id}`)} className="flex-1">
                    <Text className="font-bodyMedium text-sm text-ink" numberOfLines={2}>{p.name}</Text>
                    <Text className="font-body text-xs text-ink-soft mt-0.5">
                      €{Number(p.price).toFixed(2)} · {t("gift_reserved_of", { a: item.reserved_qty, b: item.qty })}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => run(() => removeGiftItem(item.id))} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("a11y_remove")} className="p-2">
                    <Icon name="close" size={16} color="#A79D8A" />
                  </Pressable>
                </View>

                <View className="flex-row items-center mt-3">
                  <Text className="font-body text-xs text-ink-faint flex-1">{t("gift_quantity")}</Text>
                  <Pressable
                    onPress={() => run(() => setGiftQty(item.id, item.qty - 1))}
                    disabled={busy || item.qty <= Math.max(1, item.reserved_qty)}
                    accessibilityRole="button"
                    accessibilityLabel="−"
                    className="w-8 h-8 rounded-full border border-cream-line items-center justify-center"
                    style={{ opacity: item.qty <= Math.max(1, item.reserved_qty) ? 0.35 : 1 }}
                  >
                    <Text className="font-bodySemibold text-base text-ink">−</Text>
                  </Pressable>
                  <Text className="font-bodySemibold text-sm text-ink w-8 text-center">{item.qty}</Text>
                  <Pressable
                    onPress={() => run(() => setGiftQty(item.id, item.qty + 1))}
                    disabled={busy || item.qty >= 20}
                    accessibilityRole="button"
                    accessibilityLabel="+"
                    className="w-8 h-8 rounded-full border border-cream-line items-center justify-center"
                    style={{ opacity: item.qty >= 20 ? 0.35 : 1 }}
                  >
                    <Text className="font-bodySemibold text-base text-ink">+</Text>
                  </Pressable>
                </View>

                {reservations.length > 0 ? (
                  <View className="mt-3 pt-3 border-t border-cream-line">
                    {reservations.map((r) => (
                      <View key={r.id} className="flex-row items-center justify-between py-1">
                        <Text className="font-body text-xs text-ink-soft flex-1">
                          {t("gift_reserved_by")} <Text className="font-bodySemibold text-ink">{r.name}</Text>
                          {r.qty > 1 ? ` × ${r.qty}` : ""}
                        </Text>
                        <Pressable onPress={() => run(() => releaseGiftReservation(r.id))} disabled={busy} hitSlop={8} accessibilityRole="button">
                          <Text className="font-bodyMedium text-xs text-olive">{t("gift_release")}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ZoomScreen>
        {header}
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </ZoomScreen>
    </SafeAreaView>
  );
}
