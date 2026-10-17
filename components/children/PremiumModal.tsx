import { Modal, Pressable, Text, View } from "react-native";
import { Crown } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { IconTile, TILE_COLORS } from "@/components/settings/IconTile";

/** Dritarja provizore e Premium-it: del kur prindi shton fëmijën e dytë ose zgjedh një fëmijë të kyçur. Pa pagesa. */
export function PremiumModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-[400px] rounded-3xl bg-surface p-6" accessibilityViewIsModal>
          <View className="items-center">
            <IconTile icon={Crown} color={TILE_COLORS.orange} size={52} />
            <Text accessibilityRole="header" className="mt-4 text-center font-display text-xl text-ink">
              {t("premium_title")}
            </Text>
            <Text className="mt-2 text-center font-body text-[15px] leading-5 text-ink-soft">{t("premium_body")}</Text>
            <Text className="mt-3 text-center font-body text-[13px] leading-5 text-ink-faint">{t("premium_soon")}</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="mt-6 items-center rounded-2xl bg-olive py-3.5"
          >
            <Text className="font-bodySemibold text-[15px] text-on-accent">{t("premium_ok")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
