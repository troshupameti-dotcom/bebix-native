import { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, Alert } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Icon, IconName } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { Moment, MomentType } from "@/lib/state/types";

const TYPE_ICON: Record<MomentType, IconName> = { photo: "camera", video: "play", note: "edit", milestone: "sparkle" };

type FormShape = {
  title: string;
  description: string;
  tags: string;
  favorite: boolean;
  uri: string | null;
  type: MomentType;
  date: string;
};
function formFromMoment(m: Moment): FormShape {
  return { title: m.title, description: m.description, tags: m.tags.join(", "), favorite: m.favorite, uri: m.uri, type: m.type, date: m.date };
}
function emptyForm(): FormShape {
  return { title: "", description: "", tags: "", favorite: false, uri: null, type: "note", date: new Date().toISOString() };
}

export default function MomentsScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const moments = active(state.baby.moments).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // "Pamja e ditarit" — hapet kur klikon mbi një moment te grid-i (ndryshim #7)
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewingMoment = viewingId ? moments.find((m) => m.id === viewingId) ?? null : null;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  async function pickPhotoAndAdd() {
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      baby.addMoment({ type: "photo", uri: result.assets[0].uri, title: "" });
    }
  }

  async function addPhotoToViewing() {
    if (!viewingMoment) return;
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      baby.updateMoment(viewingMoment.id, { uri: result.assets[0].uri });
    }
  }

  function openGrid(m: Moment) {
    haptics.select();
    setViewingId(m.id);
  }
  function openNote() {
    haptics.tap();
    setForm(emptyForm());
    setEditingId(null);
    setSheetOpen(true);
  }
  function openEditFromView() {
    if (!viewingMoment) return;
    haptics.select();
    setForm(formFromMoment(viewingMoment));
    setEditingId(viewingMoment.id);
    setViewingId(null);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId) baby.updateMoment(editingId, computePatch());
    setSheetOpen(false);
  }
  function computePatch() {
    return {
      title: form.title,
      description: form.description,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      favorite: form.favorite,
      date: form.date,
    };
  }
  function save() {
    if (editingId) baby.updateMoment(editingId, computePatch());
    else baby.addMoment({ type: form.type, ...computePatch() });
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteMoment(id);
    showToast(t("deleted_toast"), () => baby.restoreMoment(id));
  }
  function handleDeleteFromView() {
    if (!viewingMoment) return;
    const id = viewingMoment.id;
    Alert.alert(t("delete_action"), t("bulk_delete_confirm_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("delete_action"),
        style: "destructive",
        onPress: () => {
          haptics.warning();
          baby.deleteMoment(id);
          setViewingId(null);
          showToast(t("deleted_toast"), () => baby.restoreMoment(id));
        },
      },
    ]);
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveMoment(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateMoment(editingId);
  }
  function toggleFavoriteViewing() {
    if (!viewingMoment) return;
    haptics.select();
    baby.toggleMomentFavorite(viewingMoment.id);
  }
  const editingEntry = editingId ? moments.find((m) => m.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("moments_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {moments.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="sparkle" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("moments_empty")}</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {moments.map((m, i) => (
              <MotiView
                key={m.id}
                from={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "timing", duration: 200, delay: Math.min(i, 8) * 25 }}
                style={{ width: "31%" }}
              >
                <Pressable onPress={() => openGrid(m)} style={shadows.press} className="overflow-hidden rounded-xl2 border border-ink/10 bg-white">
                  {m.uri ? (
                    <Image source={{ uri: m.uri }} style={{ width: "100%", aspectRatio: 1 }} />
                  ) : (
                    <View style={{ width: "100%", aspectRatio: 1 }} className="items-center justify-center bg-cream-soft">
                      <Icon name={TYPE_ICON[m.type]} size={22} color="#A79D8A" />
                    </View>
                  )}
                  {m.favorite && (
                    <View className="absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full bg-white/90">
                      <Icon name="heart" size={11} color="#C9702E" />
                    </View>
                  )}
                  <Text numberOfLines={1} className="px-1.5 py-1.5 font-bodyMedium text-[10.5px] text-ink">
                    {m.title || formatDate(m.date, lang)}
                  </Text>
                </Pressable>
              </MotiView>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-2.5 px-5 pb-6">
        <Pressable onPress={pickPhotoAndAdd} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-cream-soft py-4">
          <Icon name="camera" size={16} color="#2C271F" />
          <Text className="font-bodySemibold text-[13.5px] text-ink">{t("moment_type_photo")}</Text>
        </Pressable>
        <Pressable onPress={openNote} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[13.5px] text-cream">{t("moment_add")}</Text>
        </Pressable>
      </View>

      {/* ---- Pamja e ditarit ---- */}
      <BottomSheet visible={!!viewingMoment} onClose={() => setViewingId(null)}>
        {viewingMoment && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {viewingMoment.uri ? (
              <Image source={{ uri: viewingMoment.uri }} style={{ width: "100%", aspectRatio: 1.1, borderRadius: 20 }} />
            ) : (
              <Pressable
                onPress={addPhotoToViewing}
                style={{ width: "100%", aspectRatio: 1.6 }}
                className="items-center justify-center rounded-2xl bg-cream-soft"
              >
                <Icon name="camera" size={26} color="#A79D8A" />
                <Text className="mt-2 font-body text-xs text-ink-soft">{t("baby_settings_photo")}</Text>
              </Pressable>
            )}

            <View className="mt-4 flex-row items-center justify-between">
              <Text className="flex-1 font-display text-xl text-ink">{viewingMoment.title || t("moment_add")}</Text>
              <Pressable onPress={toggleFavoriteViewing} hitSlop={8} className="ml-2">
                <Icon name="heart" size={20} color={viewingMoment.favorite ? "#C9702E" : "#A79D8A"} />
              </Pressable>
            </View>
            <Text className="mt-1 font-body text-[13px] text-ink-soft">
              {formatDate(viewingMoment.date, lang)} · {formatTime(viewingMoment.date, lang)}
            </Text>

            {viewingMoment.description ? (
              <Text className="mt-3 font-body text-[14.5px] leading-6 text-ink">{viewingMoment.description}</Text>
            ) : null}

            {viewingMoment.tags.length > 0 && (
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {viewingMoment.tags.map((tag) => (
                  <View key={tag} className="rounded-full bg-cream-soft px-3 py-1">
                    <Text className="font-bodyMedium text-[11.5px] text-ink-soft">#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-5 flex-row gap-2.5">
              <Pressable onPress={openEditFromView} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-cream-soft py-3.5">
                <Icon name="edit" size={15} color="#2C271F" />
                <Text className="font-bodySemibold text-[13.5px] text-ink">Ndrysho</Text>
              </Pressable>
              <Pressable onPress={handleDeleteFromView} className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5">
                <Icon name="close" size={15} color="#EF4444" />
                <Text className="font-bodyMedium text-[13.5px] text-red-500">{t("delete_action")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* ---- Forma e shtimit/editimit ---- */}
      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={editingId ? t("view_details") : t("moment_add")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={editingId ? form.title || undefined : undefined}
      >
        <View className="gap-4">
          <DateTimeField label={t("date_field")} mode="datetime" value={form.date} onChange={(iso) => setForm((f) => ({ ...f, date: iso }))} />
          <FormField label={t("moment_title_ph")} value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
          <FormField
            label={t("moment_desc_ph")}
            value={form.description}
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            multiline
          />
          <FormField label={t("moment_tags_ph")} value={form.tags} onChangeText={(v) => setForm((f) => ({ ...f, tags: v }))} />
          <Pressable
            onPress={() => setForm((f) => ({ ...f, favorite: !f.favorite }))}
            className="flex-row items-center gap-2.5 rounded-2xl border border-ink/10 bg-white px-4 py-3.5"
          >
            <Icon name="heart" size={16} color={form.favorite ? "#C9702E" : "#A79D8A"} />
            <Text className="font-bodyMedium text-[13.5px] text-ink">{t("moment_favorite")}</Text>
          </Pressable>
          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">{editingId ? t("save_action") : t("add_action")}</Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}