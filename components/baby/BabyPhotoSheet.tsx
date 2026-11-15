import { Pressable, Text, View } from "react-native";
import { Camera, ChevronRight, ImagePlus } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import type { PickSource } from "@/lib/media/imagePicker";

/** "Fotoja e bebit": zgjidh nga galeria ose bëj një foto. Picker-i hapet pasi fleta mbyllet. */
export function BabyPhotoSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (source: PickSource) => void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const choose = (source: PickSource) => {
    haptics.tap();
    onClose();
    // iOS s'hap dot picker-in ndërsa fleta (Modal) po mbyllet: pritet sa të mbarojë animacioni.
    setTimeout(() => onPick(source), 350);
  };
  const rows: { source: PickSource; icon: React.ReactNode; bg: string; label: string }[] = [
    { source: "library", icon: <ImagePlus size={21} color={tones.blue.tint} />, bg: tones.blue.tintBg, label: t("baby_photo_library") },
    { source: "camera", icon: <Camera size={21} color={tones.orange.tint} />, bg: tones.orange.tintBg, label: t("baby_photo_camera") },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-4 mt-2 text-center font-display text-[20px] text-ink" accessibilityRole="header">
        {t("baby_photo_sheet_title")}
      </Text>
      <View style={{ gap: 10 }}>
        {rows.map((r) => (
          <Pressable
            key={r.source}
            onPress={() => choose(r.source)}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            className="flex-row items-center rounded-2xl border border-cream-line bg-surface px-4 active:opacity-80"
            style={{ minHeight: 62, gap: 14 }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: r.bg }}>
              {r.icon}
            </View>
            <Text className="flex-1 font-bodySemibold text-[16px] text-ink">{r.label}</Text>
            <ChevronRight size={18} color={c.inkFaint} />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" className="mb-2 mt-3 items-center justify-center rounded-full" style={{ minHeight: 50 }}>
        <Text className="font-bodyMedium text-[15px] text-ink-soft">{t("cancel_action")}</Text>
      </Pressable>
    </BottomSheet>
  );
}
